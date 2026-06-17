/**
 * Minimal DB-backed advisory lock over the `semaphores` collection.
 *
 * Replaces the lock helper that lived in the deleted `$lib/migrations/lock` (the migration system
 * was removed in the B1-lite strip). Still used at runtime by OAuth token-refresh in auth.ts to
 * avoid concurrent refreshes across instances. Written fresh (our own code).
 *
 * NOTE (infra rework): on the Postgres/serverless target this should move to a Postgres advisory
 * lock or an `expires_at` row; for now it keeps the existing Mongo-semaphore behavior intact.
 */
import { ObjectId } from "bson";
import { collections } from "$lib/server/database";
import { logger } from "$lib/server/logger";

const LOCK_TTL_MS = 30_000;

/** Try to acquire the lock for `key`. Returns the lock id on success, or null if already held. */
export async function acquireLock(key: string): Promise<ObjectId | null> {
	try {
		const _id = new ObjectId();
		await collections.semaphores.insertOne({
			_id,
			key,
			createdAt: new Date(),
			updatedAt: new Date(),
			deleteAt: new Date(Date.now() + LOCK_TTL_MS),
		} as never);
		return _id;
	} catch {
		// Duplicate key (unique index on `key`) → someone else holds it.
		return null;
	}
}

/** Release a lock previously acquired with `acquireLock`. */
export async function releaseLock(key: string, lockId: ObjectId): Promise<void> {
	try {
		await collections.semaphores.deleteOne({ _id: lockId, key } as never);
	} catch (err) {
		logger.error(err, "Error releasing lock");
	}
}

/** Whether `key` is currently locked. */
export async function isDBLocked(key: string): Promise<boolean> {
	const count = await collections.semaphores.countDocuments({ key } as never);
	return count > 0;
}
