/**
 * TTL garbage collection for the infra tables.
 *
 * MongoDB expired these rows with native TTL indexes (`expireAfterSeconds`). Postgres has no native
 * TTL, so expiry is enforced two ways: the app already IGNORES expired rows at query time (e.g.
 * tokenCaches filters `createdAt > now-5min`, sessions check `expiresAt`), and this job DELETES them so
 * they don't accumulate. Correctness never depends on the GC having run — it only bounds table growth.
 *
 * Run via the daily Vercel cron (`/api/cleanup`, see vercel.json) or locally with
 * `DATABASE_URL=… npx tsx scripts/verify-cleanup.ts` (seeds + asserts) or by hitting `GET /api/cleanup`.
 *
 * Every predicate hits a promoted, indexed column (see schema.ts): sessions.expiresAt,
 * messageEvents.expiresAt, semaphores.deleteAt, tokenCaches.createdAt, abortedGenerations.updatedAt.
 */
import { lt } from "drizzle-orm";
import { getDb } from "./client";
import * as schema from "./schema";

// tokenCaches: the auth path honours a 5-minute cache by query (auth.ts) — match it here.
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
// abortedGenerations: cross-instance stop markers. They matter only while a generation is in flight;
// no generation runs anywhere near an hour, so an hour-old marker is certainly dead. Generous on
// purpose — this is a safe-GC floor, not a correctness-critical TTL.
const ABORTED_GENERATION_TTL_MS = 60 * 60 * 1000;

export type CleanupCounts = {
	sessions: number;
	messageEvents: number;
	semaphores: number;
	tokenCaches: number;
	abortedGenerations: number;
};

/**
 * Delete rows that have passed their expiry. Idempotent and safe to run any time; rows with a NULL
 * expiry column are never touched (NULL < now is NULL, i.e. not matched). Returns per-table delete
 * counts. `now` is injectable so the verification harness can reason about fixed boundaries.
 */
export async function cleanupExpired(now: Date = new Date()): Promise<CleanupCounts> {
	const db = getDb();
	const tokenCacheCutoff = new Date(now.getTime() - TOKEN_CACHE_TTL_MS);
	const abortedCutoff = new Date(now.getTime() - ABORTED_GENERATION_TTL_MS);

	// Absolute-expiry tables compare against `now`; relative-TTL tables against their cutoff.
	// `.returning({ id })` lets us report a delete count without a separate query.
	const [sessions, messageEvents, semaphores, tokenCaches, abortedGenerations] = await Promise.all([
		db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).returning({ id: schema.sessions.id }),
		db.delete(schema.messageEvents).where(lt(schema.messageEvents.expiresAt, now)).returning({ id: schema.messageEvents.id }),
		db.delete(schema.semaphores).where(lt(schema.semaphores.deleteAt, now)).returning({ id: schema.semaphores.id }),
		db.delete(schema.tokenCaches).where(lt(schema.tokenCaches.createdAt, tokenCacheCutoff)).returning({ id: schema.tokenCaches.id }),
		db.delete(schema.abortedGenerations).where(lt(schema.abortedGenerations.updatedAt, abortedCutoff)).returning({ id: schema.abortedGenerations.id }),
	]);

	return {
		sessions: sessions.length,
		messageEvents: messageEvents.length,
		semaphores: semaphores.length,
		tokenCaches: tokenCaches.length,
		abortedGenerations: abortedGenerations.length,
	};
}
