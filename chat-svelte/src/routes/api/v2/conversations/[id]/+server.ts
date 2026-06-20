import { error, type RequestHandler } from "@sveltejs/kit";
import { superjsonResponse } from "$lib/server/api/utils/superjsonResponse";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import { resolveConversation } from "$lib/server/api/utils/resolveConversation";
import { collections } from "$lib/server/database";
import { authCondition } from "$lib/server/auth";
import { ObjectId } from "bson";
import { validModelIdSchema } from "$lib/server/models";
import { deleteConversationsCascade } from "$lib/server/db/deleteConversations";

export const GET: RequestHandler = async ({ locals, params }) => {
	requireAuth(locals);

	const conversation = await resolveConversation(params.id ?? "", locals);

	return superjsonResponse({
		messages: conversation.messages,
		title: conversation.title,
		model: conversation.model,
		preprompt: conversation.preprompt,
		rootMessageId: conversation.rootMessageId,
		id: conversation._id.toString(),
		updatedAt: conversation.updatedAt,
		modelId: conversation.model,
		shared: conversation.shared,
	});
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	requireAuth(locals);

	const id = params.id ?? "";
	if (!ObjectId.isValid(id)) {
		error(400, "Invalid conversation ID");
	}
	// Scope to the caller, then FK-ordered cascade (a bare delete throws if the conversation
	// has a report — reports.conversationId is a NOT NULL FK).
	const conv = await collections.conversations.findOne({
		_id: new ObjectId(id),
		...authCondition(locals),
	});
	if (!conv) {
		error(404, "Conversation not found");
	}
	await deleteConversationsCascade([conv._id.toString()]);

	return superjsonResponse({ success: true });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	requireAuth(locals);

	const body = await request.json();
	const title = body?.title as string | undefined;
	const model = body?.model as string | undefined;

	if (title !== undefined) {
		if (typeof title !== "string" || title.length === 0 || title.length > 100) {
			error(400, "Title must be a string between 1 and 100 characters");
		}
	}

	if (model !== undefined) {
		if (!validModelIdSchema.safeParse(model).success) {
			error(400, "Invalid model ID");
		}
	}

	const updateValues = {
		...(title !== undefined && {
			title: title.replace(/<\/?think>/gi, "").trim(),
		}),
		...(model !== undefined && { model }),
	};

	const id = params.id ?? "";
	if (!ObjectId.isValid(id)) {
		error(400, "Invalid conversation ID");
	}
	const res = await collections.conversations.updateOne(
		{
			_id: new ObjectId(id),
			...authCondition(locals),
		},
		{ $set: updateValues }
	);

	if (typeof res.matchedCount === "number" ? res.matchedCount === 0 : res.modifiedCount === 0) {
		error(404, "Conversation not found");
	}

	return superjsonResponse({ success: true });
};
