/**
 * Title selection must never name a conversation after a moderation-declined (toxic / child-safety)
 * message. Title gen runs on a later clean turn but historically titled from the FIRST user message,
 * so a flagged opening message leaked toxic text into the sidebar title. firstAnsweredUserMessage
 * skips declined turns (the assistant reply carries moderation.flagged) and only titles from a turn
 * that produced a real answer.
 */
import { describe, expect, it, vi } from "vitest";

// Hermetic gate: stub $lib/server/models so importing ./title (→ generateFromDefaultEndpoint
// → models) doesn't trigger models.ts's import-time buildModels() live fetch. firstAnsweredUserMessage
// is pure; models/taskModel are only used on the live generation path.
vi.mock("$lib/server/models", () => ({
	models: [],
	defaultModel: { id: "test-model", name: "test-model" },
	taskModel: { id: "test-model", name: "test-model" },
}));

import { firstAnsweredUserMessage } from "./title";
import type { Message } from "$lib/types/Message";

// Minimal message factory — only the fields the selector reads.
function msg(id: string, from: "user" | "assistant", extra: Partial<Message> = {}): Message {
	return { id, from, content: `${from}:${id}`, ...extra } as unknown as Message;
}
const flagged = {
	moderation: { flagged: true, label: "toxic", score: 0.99, kind: "toxicity" },
} as Partial<Message>;

describe("firstAnsweredUserMessage", () => {
	it("picks the first user message when nothing is moderated", () => {
		const messages = [msg("u1", "user"), msg("a1", "assistant"), msg("u2", "user")];
		expect(firstAnsweredUserMessage(messages)?.id).toBe("u1");
	});

	it("skips a declined opening turn (adjacent assistant flagged) and titles from the next clean turn", () => {
		const messages = [
			msg("u1", "user"), // toxic
			msg("a1", "assistant", flagged), // decline
			msg("u2", "user"), // clean
			msg("a2", "assistant"), // real answer
		];
		expect(firstAnsweredUserMessage(messages)?.id).toBe("u2");
	});

	it("returns undefined when every turn so far was declined (keeps 'New Chat')", () => {
		const messages = [
			msg("u1", "user"),
			msg("a1", "assistant", flagged),
			msg("u2", "user"),
			msg("a2", "assistant", flagged),
		];
		expect(firstAnsweredUserMessage(messages)).toBeUndefined();
	});

	it("does not over-skip: a clean opening turn is kept even if a LATER turn is declined", () => {
		const messages = [
			msg("u1", "user"), // clean opening
			msg("a1", "assistant"), // real answer
			msg("u2", "user"), // later toxic
			msg("a2", "assistant", flagged), // decline
		];
		expect(firstAnsweredUserMessage(messages)?.id).toBe("u1");
	});

	it("returns undefined for an empty / assistant-only message list", () => {
		expect(firstAnsweredUserMessage([])).toBeUndefined();
		expect(firstAnsweredUserMessage([msg("a1", "assistant")])).toBeUndefined();
	});
});
