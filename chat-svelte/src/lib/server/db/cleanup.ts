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
 * messageEvents.expiresAt, semaphores.deleteAt, tokenCaches.createdAt, abortedGenerations.updatedAt,
 * conversations.updatedAt. The last one is different in kind: it enforces the user-facing /privacy
 * retention promise (delete guest conversations after RETENTION_DAYS), not just infra-table hygiene.
 */
import { lt, inArray } from "drizzle-orm";
import { getDb } from "./client";
import * as schema from "./schema";
// Relative (not `$lib`) so this module also resolves under tsx in scripts/verify-cleanup.ts,
// which runs outside Vite and can't resolve SvelteKit's `$lib` alias.
import { RETENTION_MS } from "../../constants/retention";

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
	// Conversations past the retention window (the /privacy "deleted after N days" promise).
	conversations: number;
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
		db
			.delete(schema.sessions)
			.where(lt(schema.sessions.expiresAt, now))
			.returning({ id: schema.sessions.id }),
		db
			.delete(schema.messageEvents)
			.where(lt(schema.messageEvents.expiresAt, now))
			.returning({ id: schema.messageEvents.id }),
		db
			.delete(schema.semaphores)
			.where(lt(schema.semaphores.deleteAt, now))
			.returning({ id: schema.semaphores.id }),
		db
			.delete(schema.tokenCaches)
			.where(lt(schema.tokenCaches.createdAt, tokenCacheCutoff))
			.returning({ id: schema.tokenCaches.id }),
		db
			.delete(schema.abortedGenerations)
			.where(lt(schema.abortedGenerations.updatedAt, abortedCutoff))
			.returning({ id: schema.abortedGenerations.id }),
	]);

	// Conversation retention — the user-facing /privacy promise ("guest conversations are
	// automatically deleted after N days"), not just infra-table hygiene. Messages live embedded
	// in conversations.doc, so deleting the row erases them. Dependents must go FIRST: reports has a
	// NOT NULL FK to conversations.id (a bare conversation delete would FK-fail), and files carry a
	// conversationId. Snapshot the expired ids, delete by id in one transaction so the dependent
	// deletes and the conversation delete operate on exactly the same set.
	const conversationsCutoff = new Date(now.getTime() - RETENTION_MS);
	const conversations = await db.transaction(async (tx) => {
		const expired = await tx
			.select({ id: schema.conversations.id })
			.from(schema.conversations)
			.where(lt(schema.conversations.updatedAt, conversationsCutoff));
		const expiredIds = expired.map((r) => r.id);
		if (expiredIds.length === 0) return [] as { id: string }[];
		await tx.delete(schema.reports).where(inArray(schema.reports.conversationId, expiredIds));
		await tx.delete(schema.files).where(inArray(schema.files.conversationId, expiredIds));
		return tx
			.delete(schema.conversations)
			.where(inArray(schema.conversations.id, expiredIds))
			.returning({ id: schema.conversations.id });
	});

	return {
		sessions: sessions.length,
		messageEvents: messageEvents.length,
		semaphores: semaphores.length,
		tokenCaches: tokenCaches.length,
		abortedGenerations: abortedGenerations.length,
		conversations: conversations.length,
	};
}
