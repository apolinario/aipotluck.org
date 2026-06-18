/**
 * Regression coverage for deleteConversationsCascade — the FK-ordered delete that fixes the
 * "Delete all chats gave an error" bug. The bug: `reports.conversationId` is a NOT NULL FK to
 * `conversations.id` with no ON DELETE, and `files.conversationId` references it too, so a bare
 * conversation delete throws a foreign-key violation the moment a conversation has a report or a
 * file. The headline test below seeds BOTH a report and a file against a conversation, then deletes
 * it — that is the exact path that used to throw 500.
 */
import { describe, expect, it, afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { collections } from "$lib/server/database";
import { getDb } from "$lib/server/db/client";
import * as schema from "$lib/server/db/schema";
import { newId } from "$lib/server/db/ids";
import { saveReport } from "$lib/server/db/reports";
import { deleteConversationsCascade } from "$lib/server/db/deleteConversations";
import {
	createTestUser,
	createTestConversation,
	cleanupTestData,
} from "$lib/server/api/__tests__/testHelpers";

// cleanupTestData only sweeps the Mongo-adapter collections; reports/files are normalized tables
// outside the adapter, so the tests that touch them clean up after themselves.
async function deleteReportsFor(ids: string[]) {
	if (!ids.length) return;
	await getDb().delete(schema.reports).where(inArray(schema.reports.conversationId, ids));
}
async function deleteFilesFor(ids: string[]) {
	if (!ids.length) return;
	await getDb().delete(schema.files).where(inArray(schema.files.conversationId, ids));
}

async function reportCountFor(convId: string): Promise<number> {
	const rows = await getDb()
		.select({ id: schema.reports.id })
		.from(schema.reports)
		.where(inArray(schema.reports.conversationId, [convId]));
	return rows.length;
}

async function insertFile(conversationId: string): Promise<string> {
	const id = newId();
	await getDb()
		.insert(schema.files)
		.values({
			id,
			filename: "attachment.txt",
			conversationId,
			mime: "text/plain",
			data: Buffer.from("hello"),
		});
	return id;
}

describe.sequential("deleteConversationsCascade", () => {
	afterEach(async () => {
		await cleanupTestData();
	});

	it("returns 0 and is a no-op for an empty id list", async () => {
		const deleted = await deleteConversationsCascade([]);
		expect(deleted).toBe(0);
	});

	it("deletes a conversation that has a report AND a file (the FK-violation path)", async () => {
		const { locals } = await createTestUser();
		const conv = await createTestConversation(locals, { title: "Flagged chat" });
		const convId = conv._id.toString();

		await saveReport({ conversationId: convId, reason: "harmful", sessionId: locals.sessionId });
		await insertFile(convId);

		// Before the fix this threw a foreign-key violation instead of returning a count.
		const deleted = await deleteConversationsCascade([convId]);

		expect(deleted).toBe(1);
		expect(await collections.conversations.countDocuments()).toBe(0);
		expect(await reportCountFor(convId)).toBe(0);
	});

	it("deletes plain conversations with no dependents", async () => {
		const { locals } = await createTestUser();
		const a = await createTestConversation(locals, { title: "A" });
		const b = await createTestConversation(locals, { title: "B" });

		const deleted = await deleteConversationsCascade([a._id.toString(), b._id.toString()]);

		expect(deleted).toBe(2);
		expect(await collections.conversations.countDocuments()).toBe(0);
	});

	it("only deletes the targeted conversations, leaving others (and their reports) intact", async () => {
		const { locals } = await createTestUser();
		const target = await createTestConversation(locals, { title: "Target" });
		const keep = await createTestConversation(locals, { title: "Keep" });
		const targetId = target._id.toString();
		const keepId = keep._id.toString();

		await saveReport({ conversationId: targetId, reason: "harmful", sessionId: locals.sessionId });
		await saveReport({ conversationId: keepId, reason: "inaccurate", sessionId: locals.sessionId });

		try {
			const deleted = await deleteConversationsCascade([targetId]);

			expect(deleted).toBe(1);
			expect(await collections.conversations.countDocuments()).toBe(1);
			expect(await reportCountFor(targetId)).toBe(0);
			expect(await reportCountFor(keepId)).toBe(1);
		} finally {
			await deleteReportsFor([keepId, targetId]);
			await deleteFilesFor([keepId, targetId]);
		}
	});
});
