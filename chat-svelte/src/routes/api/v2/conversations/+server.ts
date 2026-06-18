import type { RequestHandler } from "@sveltejs/kit";
import { superjsonResponse } from "$lib/server/api/utils/superjsonResponse";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import { collections } from "$lib/server/database";
import { authCondition } from "$lib/server/auth";
import type { Conversation } from "$lib/types/Conversation";
import { CONV_NUM_PER_PAGE } from "$lib/constants/pagination";
import { deleteConversationsCascade } from "$lib/server/db/deleteConversations";

export const GET: RequestHandler = async ({ locals, url }) => {
	requireAuth(locals);

	const pageSize = CONV_NUM_PER_PAGE;
	const p = parseInt(url.searchParams.get("p") ?? "0") || 0;

	const convs = await collections.conversations
		.find(authCondition(locals))
		.project<Pick<Conversation, "_id" | "title" | "updatedAt" | "model">>({
			title: 1,
			updatedAt: 1,
			model: 1,
		})
		.sort({ updatedAt: -1 })
		.skip(p * pageSize)
		.limit(pageSize + 1)
		.toArray();

	const hasMore = convs.length > pageSize;
	const res = (hasMore ? convs.slice(0, pageSize) : convs).map((conv) => ({
		_id: conv._id,
		id: conv._id, // legacy param iOS
		title: conv.title,
		updatedAt: conv.updatedAt,
		model: conv.model,
		modelId: conv.model, // legacy param iOS
	}));

	return superjsonResponse({ conversations: res, hasMore });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	requireAuth(locals);

	// FK-ordered cascade: resolve the caller's conversation ids, then delete dependents + the
	// conversations in one transaction. A bare conversations.deleteMany() throws once any of them
	// has a report (NOT NULL FK) — which is what "Delete all chats" was erroring on.
	const convs = await collections.conversations
		.find(authCondition(locals))
		.project<Pick<Conversation, "_id">>({ _id: 1 })
		.toArray();
	const ids = convs.map((c) => c._id.toString());
	const deletedCount = await deleteConversationsCascade(ids);

	return superjsonResponse(deletedCount);
};
