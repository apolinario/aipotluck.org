import { collections } from "$lib/server/database";
import { config } from "$lib/server/config";
import { hashIp } from "$lib/server/db/ipHash";
import { usageLimits } from "$lib/server/usageLimits";
import { logger } from "$lib/server/logger.js";
import { ERROR_MESSAGES } from "$lib/stores/errors";
import type { MessageEvent } from "$lib/types/MessageEvent";
import { error } from "@sveltejs/kit";

/**
 * Enforce the per-turn request limits before a generation runs. Records the turn for
 * rate-limit bookkeeping and applies three independent guardrails:
 *
 *   1. Per-SESSION per-minute limit — the fair, NAT-safe primary limit.
 *   2. Per-IP per-minute ceiling — OFF by default (would lock out a shared NAT); opt-in.
 *   3. Service-wide DAILY request cap — a cost/abuse backstop for the limited compute budget.
 *
 * Every counter/insert is best-effort and FAILS OPEN: a DB blip must never take down a turn
 * (a transient insert failure here once 500'd every chat request). Only an actual over-limit
 * count throws — a 429 via `error()`, which propagates out of the route handler.
 */
export async function enforceRequestRateLimits(opts: {
	userId: MessageEvent["userId"];
	clientAddress: string;
}): Promise<void> {
	const { userId, clientAddress } = opts;

	// Register the event for ratelimiting — best-effort. Rate-limit bookkeeping is infrastructure and
	// must NEVER take down a turn: a DB blip here once 500'd every chat request (the insert threw before
	// the model ran). On failure we log and continue (fail open); the worst case is one un-recorded event,
	// a slight under-count that is acceptable for a soft per-minute limit.
	try {
		await collections.messageEvents.insertOne({
			type: "message",
			userId,
			createdAt: new Date(),
			expiresAt: new Date(Date.now() + 60_000),
			ipHash: hashIp(clientAddress, "rate-limit"),
		});
	} catch (e) {
		logger.warn(e, "[rate-limit] failed to record message event — continuing (fail open)");
	}

	if (usageLimits?.messagesPerMinute) {
		// Per-SESSION limit (each guest/user has a unique sessionId) — the fair, NAT-SAFE primary
		// limit: one person can't spam, but classmates sharing a public IP behind a NAT each get their
		// own budget. (Hard-won lesson: a per-IP limit at the per-person rate once locked out a whole
		// NAT'd classroom at once — exactly the education audience this alpha targets.)
		// Fail open on a count error (DB blip) — same posture as the global daily cap below: a limiter
		// failure must not block a turn. Only an actual over-limit count (not a failed count) 429s.
		let perSession: number | null = null;
		try {
			perSession = await collections.messageEvents.countDocuments({
				userId,
				type: "message",
				expiresAt: { $gt: new Date() },
			});
		} catch (e) {
			logger.warn(e, "[rate-limit] per-session count failed — failing open");
		}
		if (perSession !== null && perSession > usageLimits.messagesPerMinute) {
			error(429, ERROR_MESSAGES.rateLimited);
		}
		// Per-IP limiting is OFF by default — a single conference/lecture-hall wifi NAT can put a
		// thousand phones behind ONE IP, so any per-IP cap risks locking out the whole room (the exact
		// failure we're avoiding). Per-session above is the NAT-safe limiter; the global daily cap is
		// the runaway-spend backstop. Enable a LOOSE per-IP anti-abuse ceiling only if a specific
		// single-IP-many-sessions abuse appears, by setting RATE_LIMIT_IP_MULTIPLIER (× messagesPerMinute);
		// keep it generous (it is a runaway ceiling, never the per-person rate).
		const ipMultiplier = Number(Reflect.get(config, "RATE_LIMIT_IP_MULTIPLIER")) || 0;
		// Count against the SAME keyed hash we store on insert (domain "rate-limit"). When no pepper is
		// configured hashIp returns null — we then skip the per-IP ceiling entirely (fail open), rather
		// than count rows where ip_hash IS NULL, which would conflate every unhashed event into one bucket.
		const ipHash = hashIp(clientAddress, "rate-limit");
		if (ipMultiplier > 0 && ipHash) {
			let perIp: number | null = null;
			try {
				perIp = await collections.messageEvents.countDocuments({
					ipHash,
					type: "message",
					expiresAt: { $gt: new Date() },
				});
			} catch (e) {
				logger.warn(e, "[rate-limit] per-IP count failed — failing open");
			}
			if (perIp !== null && perIp > usageLimits.messagesPerMinute * ipMultiplier) {
				error(429, ERROR_MESSAGES.rateLimited);
			}
		}
	}

	// Service-wide DAILY request cap — a cost/abuse guardrail for the limited CSCS/HF compute budget,
	// distinct from the per-user/per-IP per-minute limit above. Counts requests in a rolling 24h window
	// via a dedicated "globalDaily" messageEvent (the table + cleanup already GC by expiresAt). The DB
	// count is approximate (the best-fit for serverless — no Redis): a brief overshoot under concurrency
	// or a transient error is acceptable for a soft cap. FAIL-OPEN on a count error so a DB blip can't
	// take the whole service down; logged when hit / on error. Disabled when the env var is unset/0.
	const globalDailyCap = Number(config.GLOBAL_DAILY_REQUEST_CAP) || 0;
	if (globalDailyCap > 0) {
		let dailyCount: number | null = null;
		try {
			dailyCount = await collections.messageEvents.countDocuments({
				type: "globalDaily",
				expiresAt: { $gt: new Date() },
			});
		} catch (e) {
			logger.warn(e, "[rate-limit] global daily cap count failed — failing open");
		}
		if (dailyCount !== null && dailyCount >= globalDailyCap) {
			logger.warn({ dailyCount, globalDailyCap }, "[rate-limit] global daily request cap reached");
			error(429, "The service has reached today's request limit. Please try again later.");
		}
		// Record this request in the 24h window (best-effort — a failed insert just under-counts).
		try {
			await collections.messageEvents.insertOne({
				type: "globalDaily",
				userId,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
				ipHash: hashIp(clientAddress, "rate-limit"),
			});
		} catch (e) {
			logger.warn(e, "[rate-limit] global daily event insert failed");
		}
	}
}
