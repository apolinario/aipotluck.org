import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";

const IP_TTL_SECONDS = 60 * 60; // 1h window for the per-IP request count
const GLOBAL_TTL_SECONDS = 60 * 60 * 25; // ~25h, comfortably past one UTC day

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client && process.env.REDIS_URL) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => undefined);
    client.connect().catch(() => {
      client = null;
    });
  }
  return client;
}

// Shared guard: the Redis-backed limiters only run in production, and they fail
// LOUD-but-OPEN — if Redis is absent the per-user message cap (enforced in the
// chat route against the DB) still covers chat, so we log the gap rather than
// fail closed and self-DoS on a transient blip. Returns null when the caller
// should skip (not prod, or Redis unavailable), else a ready client.
function readyRedisOrSkip(label: string) {
  if (!isProductionEnvironment) {
    return null;
  }
  if (!process.env.REDIS_URL) {
    console.error(
      `[ratelimit] REDIS_URL not set in production — ${label} is DISABLED (per-user cap still applies)`
    );
    return null;
  }
  const redis = getClient();
  if (!redis?.isReady) {
    console.error(
      `[ratelimit] Redis not ready in production — ${label} skipped for this request (per-user cap still applies)`
    );
    return null;
  }
  return redis;
}

// Per-IP backstop: caps chat POST requests per IP per hour. Coarser than the
// per-user message cap (see LIMITS.ipRequestsPerHour) so it only catches abuse,
// not legitimate multi-request turns.
export async function checkIpRateLimit(ip: string | undefined) {
  if (!ip) {
    return;
  }
  const redis = readyRedisOrSkip("IP rate limiting");
  if (!redis) {
    return;
  }

  try {
    const key = `ip-rate-limit:${ip}`;
    const [count] = await redis
      .multi()
      .incr(key)
      .expire(key, IP_TTL_SECONDS, "NX")
      .exec();

    if (typeof count === "number" && count > LIMITS.ipRequestsPerHour) {
      throw new ChatbotError("rate_limit:chat");
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    console.error("[ratelimit] IP rate-limit check failed:", error);
  }
}

// Per-IP daily cap for the public contribution form. Its own Redis key (not the
// chat counter), a coarse anti-spam backstop. Same fail-loud-but-open contract:
// if Redis is absent the form still works (we'd rather lose spam protection than
// drop a real contributor's submission). Throws a generic bad-request on trip so
// the form shows "couldn't send", not a chat-specific message.
export async function checkContributionRateLimit(ip: string | undefined) {
  if (!ip) {
    return;
  }
  const redis = readyRedisOrSkip("contribution rate limiting");
  if (!redis) {
    return;
  }

  try {
    const key = `contribution-rate-limit:${ip}`;
    const [count] = await redis
      .multi()
      .incr(key)
      .expire(key, GLOBAL_TTL_SECONDS, "NX")
      .exec();

    if (typeof count === "number" && count > LIMITS.contributionsPerDayPerIp) {
      throw new ChatbotError("bad_request:api", "Too many submissions today.");
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    console.error("[ratelimit] contribution rate-limit check failed:", error);
  }
}

// Global circuit-breaker: caps total chat POST requests across ALL users per
// UTC day. This is the budget ceiling — per-identity caps are defeated by fresh
// guest ids or rotated IPs, so only a global counter bounds aggregate inference
// spend. Trips a graceful "at capacity" response (distinct from the per-user
// "you've hit your limit" message). Tune LIMITS.globalRequestsPerDay to budget.
export async function checkGlobalRateLimit() {
  const redis = readyRedisOrSkip("global capacity cap");
  if (!redis) {
    return;
  }

  try {
    const day = new Date().toISOString().slice(0, 10); // UTC calendar day
    const key = `global-rate-limit:${day}`;
    const [count] = await redis
      .multi()
      .incr(key)
      .expire(key, GLOBAL_TTL_SECONDS, "NX")
      .exec();

    if (typeof count === "number" && count > LIMITS.globalRequestsPerDay) {
      throw new ChatbotError("rate_limit:capacity");
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    console.error("[ratelimit] global capacity check failed:", error);
  }
}
