import { describe, expect, it } from "vitest";
import type { Conversation } from "$lib/types/Conversation";
import { addChildren } from "$lib/utils/tree/addChildren.js";
import { appendTurnMessages } from "./messageTree";

// Minimal in-memory conversation (only the tree fields appendTurnMessages touches).
function emptyConv(): Conversation {
	return { messages: [], rootMessageId: undefined } as unknown as Conversation;
}

function turn(conv: Conversation, content: string, from: "user" | "assistant", parentId?: string) {
	return addChildren(
		conv,
		{ from, content, createdAt: new Date(), updatedAt: new Date() },
		parentId
	);
}

// Seed a two-turn conversation (user1 → assistant1 → user2 → assistant2). Two turns so the
// "edit a user message" case targets a NON-root user message (the root can't take a sibling).
function seededConv() {
	const conv = emptyConv();
	const rootId = turn(conv, "hello", "user");
	conv.rootMessageId = rootId;
	const assistant1 = turn(conv, "hi there", "assistant", rootId);
	const userId = turn(conv, "follow up", "user", assistant1);
	const assistantId = turn(conv, "an answer", "assistant", userId);
	return { conv, rootId, userId, assistantId };
}

describe("appendTurnMessages", () => {
	it("normal turn appends a user message and a blank assistant child", () => {
		const { conv, assistantId } = seededConv();
		const before = conv.messages.length;

		const { messageToWriteToId, messagesForPrompt } = appendTurnMessages(conv, {
			// a normal turn always carries the parent (leaf) message id from the client
			messageId: assistantId,
			newPrompt: "second question",
			uploadedFiles: [],
		});

		// two new messages (user + assistant) added
		expect(conv.messages.length).toBe(before + 2);
		const writeTo = conv.messages.find((m) => m.id === messageToWriteToId);
		expect(writeTo?.from).toBe("assistant");
		expect(writeTo?.content).toBe("");
		// the prompt subtree ends on the new user message, not the blank assistant
		expect(messagesForPrompt.at(-1)?.from).toBe("user");
		expect(messagesForPrompt.at(-1)?.content).toBe("second question");
	});

	it("retrying an assistant message adds a sibling and drops the old answer from the prompt", () => {
		const { conv, assistantId } = seededConv();

		const { messageToWriteToId, messagesForPrompt } = appendTurnMessages(conv, {
			isRetry: true,
			messageId: assistantId,
			uploadedFiles: [],
		});

		const writeTo = conv.messages.find((m) => m.id === messageToWriteToId);
		expect(writeTo?.from).toBe("assistant");
		expect(writeTo?.id).not.toBe(assistantId); // a fresh sibling, not the original
		// the assistant message being retried is not part of the prompt
		expect(messagesForPrompt.some((m) => m.id === assistantId)).toBe(false);
		expect(messagesForPrompt.at(-1)?.from).toBe("user");
	});

	it("editing a user message (retry with newPrompt) forks a user sibling + blank assistant", () => {
		const { conv, userId } = seededConv();

		const { messageToWriteToId, messagesForPrompt } = appendTurnMessages(conv, {
			isRetry: true,
			messageId: userId,
			newPrompt: "edited question",
			uploadedFiles: [],
		});

		const writeTo = conv.messages.find((m) => m.id === messageToWriteToId);
		expect(writeTo?.from).toBe("assistant");
		expect(messagesForPrompt.at(-1)?.content).toBe("edited question");
	});

	it("throws 404 when retrying a message that does not exist", () => {
		const { conv } = seededConv();
		expect(() =>
			appendTurnMessages(conv, {
				isRetry: true,
				messageId: "00000000-0000-0000-0000-000000000000",
				uploadedFiles: [],
			})
		).toThrow();
	});

	// Regression: a normal (non-retry) turn whose parent ref is stale — a resend after an interrupted
	// generation left the client pointing at a message the server never persisted — used to build a
	// dangling node and 500 with "Ancestor not found" downstream in buildSubtree. It must now re-point
	// to the current leaf and land the turn.
	it("re-points to the current leaf when a normal turn's parent reference is stale (no throw)", () => {
		const { conv } = seededConv();
		const before = conv.messages.length;
		const leafBefore = conv.messages[conv.messages.length - 1].id;

		const { messageToWriteToId, messagesForPrompt } = appendTurnMessages(conv, {
			messageId: "ghost-id-not-in-tree", // stale: not in conv.messages
			newPrompt: "still want an answer",
			uploadedFiles: [],
		});

		expect(messageToWriteToId).toBeDefined();
		expect(conv.messages.length).toBe(before + 2); // user + blank assistant appended, not orphaned
		// the new user message attached under the real leaf, and the prompt subtree built cleanly
		const newUser = messagesForPrompt.at(-1);
		expect(newUser?.from).toBe("user");
		expect(newUser?.content).toBe("still want an answer");
		expect(newUser?.ancestors).toContain(leafBefore);
		// no dangling ancestor id survives in the built subtree
		const ids = new Set(conv.messages.map((m) => m.id));
		for (const m of messagesForPrompt)
			for (const a of m.ancestors ?? []) expect(ids.has(a)).toBe(true);
	});
});
