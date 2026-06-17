/**
 * Daily TTL garbage collection endpoint, invoked by the Vercel cron in vercel.json.
 *
 * Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is set
 * (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). We require it in production —
 * an unauthenticated endpoint that deletes rows is an abuse vector, so we refuse rather than run open.
 * In local dev (no secret) it's open so you can hit `GET /api/cleanup` directly; the standalone
 * `scripts/verify-cleanup.ts` exercises the same `cleanupExpired()` against the local Docker Postgres.
 */
import { json, type RequestHandler } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { cleanupExpired } from "$lib/server/db/cleanup";
import { logger } from "$lib/server/logger";

function authorized(request: Request): boolean {
	const secret = env.CRON_SECRET;
	if (!secret) return dev; // open in dev only; refuse in prod when unconfigured
	const header = request.headers.get("authorization");
	return header === `Bearer ${secret}`;
}

export const GET: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: "unauthorized" }, { status: 401 });
	}
	const counts = await cleanupExpired();
	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	logger.info({ counts, total }, "TTL cleanup");
	return json({ ok: true, deleted: counts, total });
};
