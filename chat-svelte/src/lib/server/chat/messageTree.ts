import { error } from "@sveltejs/kit";
import type { Conversation } from "$lib/types/Conversation";
import type { Message } from "$lib/types/Message";
import { buildSubtree } from "$lib/utils/tree/buildSubtree.js";
import { addChildren } from "$lib/utils/tree/addChildren.js";
import { addSibling } from "$lib/utils/tree/addSibling.js";

/**
 * Append this turn's message(s) to the conversation tree and return the assistant message we'll
 * stream into plus the subtree used to build the prompt. Three cases:
 *
 *   - retry of a USER message with a new prompt → edit: add a user sibling + blank assistant child.
 *   - retry of an ASSISTANT message → regenerate: add a blank assistant sibling, drop the old
 *     answer from the prompt subtree.
 *   - normal turn → append the user message + a blank assistant child back to back.
 *
 * Mutates `conv.messages` in place (via the tree helpers). `messageToWriteToId` is left undefined
 * for a retry that matches neither case (e.g. retrying a user message with no new prompt); the
 * caller validates the result.
 */
export function appendTurnMessages(
	conv: Conversation,
	opts: {
		isRetry?: boolean;
		messageId?: Message["id"];
		newPrompt?: string;
		uploadedFiles: NonNullable<Message["files"]>;
	}
): { messageToWriteToId: Message["id"] | undefined; messagesForPrompt: Message[] } {
	const { isRetry, messageId, newPrompt, uploadedFiles } = opts;

	// we will append tokens to the content of this message
	let messageToWriteToId: Message["id"] | undefined = undefined;
	// used for building the prompt, subtree of the conversation that goes from the latest message to the root
	let messagesForPrompt: Message[] = [];

	if (isRetry && messageId) {
		// two cases, if we're retrying a user message with a newPrompt set,
		// it means we're editing a user message
		// if we're retrying on an assistant message, newPrompt cannot be set
		// it means we're retrying the last assistant message for a new answer

		const messageToRetry = conv.messages.find((message) => message.id === messageId);

		if (!messageToRetry) {
			error(404, "Message not found");
		}

		if (messageToRetry.from === "user" && newPrompt) {
			// add a sibling to this message from the user, with the alternative prompt
			// add a children to that sibling, where we can write to
			const newUserMessageId = addSibling(
				conv,
				{
					from: "user",
					content: newPrompt,
					files: uploadedFiles,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				messageId
			);
			messageToWriteToId = addChildren(
				conv,
				{
					from: "assistant",
					content: "",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				newUserMessageId
			);
			messagesForPrompt = buildSubtree(conv, newUserMessageId);
		} else if (messageToRetry.from === "assistant") {
			// we're retrying an assistant message, to generate a new answer
			// just add a sibling to the assistant answer where we can write to
			messageToWriteToId = addSibling(
				conv,
				{ from: "assistant", content: "", createdAt: new Date(), updatedAt: new Date() },
				messageId
			);
			messagesForPrompt = buildSubtree(conv, messageId);
			messagesForPrompt.pop(); // don't need the latest assistant message in the prompt since we're retrying it
		}
	} else {
		// just a normal linear conversation, so we add the user message
		// and the blank assistant message back to back
		const newUserMessageId = addChildren(
			conv,
			{
				from: "user",
				content: newPrompt ?? "",
				files: uploadedFiles,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			messageId
		);

		messageToWriteToId = addChildren(
			conv,
			{
				from: "assistant",
				content: "",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			newUserMessageId
		);
		// build the prompt from the user message
		messagesForPrompt = buildSubtree(conv, newUserMessageId);
	}

	return { messageToWriteToId, messagesForPrompt };
}
