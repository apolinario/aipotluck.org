import { describe, expect, test } from "vitest";

import type { Message } from "$lib/types/Message";
import { MessageUpdateStatus, MessageUpdateType } from "$lib/types/MessageUpdate";
import {
	deriveMessageStatus,
	GENERATION_STALE_MS,
	isAssistantGenerationTerminal,
	isConversationGenerationActive,
	isGenerationStale,
} from "./generationState";

function assistantMessage(overrides: Partial<Message> = {}): Message {
	return {
		from: "assistant",
		id: "assistant-1" as Message["id"],
		content: "",
		children: [],
		...overrides,
	};
}

describe("generationState", () => {
	test("returns active when assistant has no terminal update", () => {
		const messages = [
			assistantMessage({
				updates: [{ type: MessageUpdateType.Stream, token: "Hello" }],
			}),
		];

		expect(isConversationGenerationActive(messages)).toBe(true);
	});

	test("treats final answer update as terminal", () => {
		const message = assistantMessage({
			updates: [{ type: MessageUpdateType.FinalAnswer, text: "Done", interrupted: false }],
		});

		expect(isAssistantGenerationTerminal(message)).toBe(true);
		expect(isConversationGenerationActive([message])).toBe(false);
	});

	test("treats error status update as terminal", () => {
		const message = assistantMessage({
			updates: [
				{
					type: MessageUpdateType.Status,
					status: MessageUpdateStatus.Error,
					message: "Something went wrong",
				},
			],
		});

		expect(isAssistantGenerationTerminal(message)).toBe(true);
		expect(isConversationGenerationActive([message])).toBe(false);
	});

	test("treats finished status update as terminal", () => {
		const message = assistantMessage({
			updates: [
				{
					type: MessageUpdateType.Status,
					status: MessageUpdateStatus.Finished,
				},
			],
		});

		expect(isAssistantGenerationTerminal(message)).toBe(true);
		expect(isConversationGenerationActive([message])).toBe(false);
	});

	test("treats interrupted assistant message as terminal", () => {
		const message = assistantMessage({
			interrupted: true,
			updates: [{ type: MessageUpdateType.Stream, token: "partial" }],
		});

		expect(isAssistantGenerationTerminal(message)).toBe(true);
		expect(isConversationGenerationActive([message])).toBe(false);
	});
});

describe("deriveMessageStatus", () => {
	test("running while no terminal update has arrived", () => {
		expect(
			deriveMessageStatus(
				assistantMessage({ updates: [{ type: MessageUpdateType.Stream, token: "Hel" }] })
			)
		).toBe("running");
	});

	test("complete on a clean final answer", () => {
		expect(
			deriveMessageStatus(
				assistantMessage({
					updates: [{ type: MessageUpdateType.FinalAnswer, text: "Done", interrupted: false }],
				})
			)
		).toBe("complete");
	});

	test("error wins on an error status", () => {
		expect(
			deriveMessageStatus(
				assistantMessage({
					updates: [
						{ type: MessageUpdateType.Status, status: MessageUpdateStatus.Error, message: "boom" },
					],
				})
			)
		).toBe("error");
	});

	test("incomplete on the persisted interrupted flag (with partial content preserved)", () => {
		expect(
			deriveMessageStatus(
				assistantMessage({
					interrupted: true,
					content: "partial answer the user already saw",
					updates: [{ type: MessageUpdateType.Stream, token: "partial" }],
				})
			)
		).toBe("incomplete");
	});

	test("incomplete on a final-answer flagged interrupted", () => {
		expect(
			deriveMessageStatus(
				assistantMessage({
					updates: [{ type: MessageUpdateType.FinalAnswer, text: "cut off", interrupted: true }],
				})
			)
		).toBe("incomplete");
	});

	test("error takes precedence over interrupted when both are present", () => {
		expect(
			deriveMessageStatus(
				assistantMessage({
					interrupted: true,
					updates: [
						{ type: MessageUpdateType.Status, status: MessageUpdateStatus.Error, message: "boom" },
					],
				})
			)
		).toBe("error");
	});

	test("non-assistant messages are always complete", () => {
		expect(deriveMessageStatus({ from: "user", id: "u1" as Message["id"], content: "hi" })).toBe(
			"complete"
		);
	});
});

describe("isGenerationStale", () => {
	test("a recent write is not stale", () => {
		expect(isGenerationStale(new Date())).toBe(false);
		expect(isGenerationStale(new Date(Date.now() - GENERATION_STALE_MS + 5_000))).toBe(false);
	});

	test("a write older than the threshold is stale", () => {
		expect(isGenerationStale(new Date(Date.now() - GENERATION_STALE_MS - 1_000))).toBe(true);
	});

	test("accepts ISO strings (API payloads)", () => {
		expect(
			isGenerationStale(new Date(Date.now() - GENERATION_STALE_MS - 1_000).toISOString())
		).toBe(true);
		expect(isGenerationStale(new Date().toISOString())).toBe(false);
	});

	test("missing or invalid timestamps are never stale", () => {
		expect(isGenerationStale(undefined)).toBe(false);
		expect(isGenerationStale("not-a-date")).toBe(false);
	});
});
