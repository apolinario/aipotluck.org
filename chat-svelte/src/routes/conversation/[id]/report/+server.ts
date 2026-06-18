/**
 * Report a problem with a response — the user-facing flag affordance the Terms page promises
 * ("use the control beneath any response to flag it"). Mirrors the Vercel app's report route and
 * writes through saveReport (db/reports.ts), the single ROOST triage seam. Present on every
 * session regardless of auth (docx P0): a guest can flag, so there is no auth WALL, but the report
 * is scoped to a conversation the caller actually owns (authCondition) so reports can't be forged
 * against arbitrary conversation ids.
 */
import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { saveReport } from "$lib/server/db/reports";
import { error, json, type RequestHandler } from "@sveltejs/kit";
import { ObjectId } from "bson";
import { z } from "zod";

const reportSchema = z.object({
	// Which message in the conversation is being flagged (optional — a report can be
	// conversation-level). Kept as a free string; the UI passes the assistant message id.
	messageId: z.string().max(128).nullish(),
	reason: z.enum(["harmful", "inaccurate", "privacy", "other"]),
	detail: z.string().max(2000).nullish(),
});

export const POST: RequestHandler = async ({ request, locals, params }) => {
	let body: z.infer<typeof reportSchema>;
	try {
		body = reportSchema.parse(await request.json());
	} catch {
		throw error(400, "A valid reason is required.");
	}

	const id = z.string().parse(params.id);
	const convId = new ObjectId(id);

	// Scope to a conversation the caller owns (guest session or logged-in user). Prevents
	// forging reports against conversations the caller is not part of.
	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});
	if (!conv) {
		throw error(404, "Conversation not found");
	}

	try {
		await saveReport({
			conversationId: id,
			messageId: body.messageId ?? undefined,
			userId: locals.user?._id?.toString(),
			sessionId: locals.sessionId,
			reason: body.reason,
			detail: body.detail ?? undefined,
		});
	} catch {
		throw error(500, "Failed to save report");
	}

	return json({ ok: true });
};
