/**
 * FK-ordered cascade delete for conversations — the single place conversation deletion happens so
 * the foreign keys can't block it. `reports.conversationId` is a NOT NULL FK to `conversations.id`
 * with no ON DELETE, and `files` carry a `conversationId`, so a bare conversation delete throws a
 * foreign-key violation the moment a conversation has a report or file (which "Delete all chats"
 * and the per-chat delete both hit). Delete the dependents FIRST, in one transaction. Mirrors the
 * TTL sweep in db/cleanup.ts.
 */
import { inArray } from "drizzle-orm";
import { getDb } from "./client";
import * as schema from "./schema";

export async function deleteConversationsCascade(conversationIds: string[]): Promise<number> {
	if (conversationIds.length === 0) return 0;
	const db = getDb();
	return db.transaction(async (tx) => {
		await tx.delete(schema.reports).where(inArray(schema.reports.conversationId, conversationIds));
		await tx.delete(schema.files).where(inArray(schema.files.conversationId, conversationIds));
		const deleted = await tx
			.delete(schema.conversations)
			.where(inArray(schema.conversations.id, conversationIds))
			.returning({ id: schema.conversations.id });
		return deleted.length;
	});
}
