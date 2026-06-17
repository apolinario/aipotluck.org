import { collections } from "$lib/server/database";
import { ObjectId } from "bson";
import { authCondition } from "$lib/server/auth";
import { convertLegacyConversation } from "$lib/utils/tree/convertLegacyConversation";
import { error } from "@sveltejs/kit";

/**
 * Resolve an owned conversation by ObjectId, with an auth check.
 * (Shared-conversation lookups removed in the B1-lite strip.)
 *
 * Returns the conversation with legacy fields converted.
 */
export async function resolveConversation(id: string, locals: App.Locals) {
	try {
		new ObjectId(id);
	} catch {
		error(400, "Invalid conversation ID format");
	}

	const conversation = await collections.conversations.findOne({
		_id: new ObjectId(id),
		...authCondition(locals),
	});

	if (!conversation) {
		const conversationExists =
			(await collections.conversations.countDocuments({
				_id: new ObjectId(id),
			})) !== 0;

		if (conversationExists) {
			error(403, "You don't have access to this conversation.");
		}

		error(404, "Conversation not found.");
	}

	return {
		...conversation,
		...convertLegacyConversation(conversation),
		shared: false,
	};
}
