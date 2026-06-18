/**
 * Coverage for the report endpoint — the ROOST triage write seam. Two security properties matter:
 * a report is scoped to a conversation the caller actually owns (no forging against arbitrary ids),
 * and an invalid reason is rejected. The happy path persists a row through saveReport.
 */
import { describe, expect, it, afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { ObjectId } from "bson";
import { getDb } from "$lib/server/db/client";
import * as schema from "$lib/server/db/schema";
import {
	createTestUser,
	createTestConversation,
	cleanupTestData,
} from "$lib/server/api/__tests__/testHelpers";
import { POST } from "./+server";

async function reportsFor(convId: string) {
	return getDb()
		.select()
		.from(schema.reports)
		.where(inArray(schema.reports.conversationId, [convId]));
}

async function postReport(args: {
	locals: App.Locals;
	id: string;
	body: unknown;
}): Promise<Response> {
	const request = new Request(`http://localhost/conversation/${args.id}/report`, {
		method: "POST",
		body: JSON.stringify(args.body),
	});
	return POST({ request, locals: args.locals, params: { id: args.id } } as never);
}

async function expectThrownStatus(p: Promise<Response>, status: number) {
	try {
		await p;
		expect.fail("Should have thrown");
	} catch (e: unknown) {
		expect((e as { status: number }).status).toBe(status);
	}
}

describe.sequential("POST /conversation/[id]/report", () => {
	afterEach(async () => {
		await cleanupTestData();
	});

	it("saves a report against a conversation the caller owns", async () => {
		const { locals } = await createTestUser();
		const conv = await createTestConversation(locals);
		const convId = conv._id.toString();

		try {
			const res = await postReport({
				locals,
				id: convId,
				body: { reason: "harmful", messageId: "msg-1", detail: "abusive" },
			});

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ ok: true });

			const rows = await reportsFor(convId);
			expect(rows).toHaveLength(1);
			expect(rows[0].reason).toBe("harmful");
			expect(rows[0].messageId).toBe("msg-1");
			expect(rows[0].detail).toBe("abusive");
		} finally {
			await getDb().delete(schema.reports).where(inArray(schema.reports.conversationId, [convId]));
		}
	});

	it("rejects a report against a conversation the caller does not own (404)", async () => {
		const { locals: owner } = await createTestUser();
		const { locals: attacker } = await createTestUser();
		const conv = await createTestConversation(owner);
		const convId = conv._id.toString();

		await expectThrownStatus(
			postReport({ locals: attacker, id: convId, body: { reason: "harmful" } }),
			404
		);

		expect(await reportsFor(convId)).toHaveLength(0);
	});

	it("returns 404 for a conversation that does not exist", async () => {
		const { locals } = await createTestUser();
		await expectThrownStatus(
			postReport({ locals, id: new ObjectId().toString(), body: { reason: "harmful" } }),
			404
		);
	});

	it("rejects an invalid reason (400)", async () => {
		const { locals } = await createTestUser();
		const conv = await createTestConversation(locals);

		await expectThrownStatus(
			postReport({ locals, id: conv._id.toString(), body: { reason: "not-a-reason" } }),
			400
		);

		expect(await reportsFor(conv._id.toString())).toHaveLength(0);
	});
});
