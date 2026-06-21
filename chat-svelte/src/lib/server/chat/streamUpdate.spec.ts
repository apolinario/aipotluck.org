import { describe, it, expect, vi } from "vitest";
import {
	applyMessageUpdate,
	createStreamState,
	type ApplyUpdateContext,
	type MetricsContext,
} from "./streamUpdate";
import {
	MessageUpdateStatus,
	MessageUpdateType,
	MessageReasoningUpdateType,
	type MessageUpdate,
} from "$lib/types/MessageUpdate";
import type { Message } from "$lib/types/Message";

function emptyMessage(content = ""): Message {
	return { from: "assistant", id: "msg-1", content, updates: [] };
}

function makeCtx(overrides: Partial<ApplyUpdateContext> = {}): ApplyUpdateContext {
	return {
		message: emptyMessage(),
		initialMessageContent: "",
		model: { isRouter: false },
		state: createStreamState(),
		metrics: undefined,
		saveTitle: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

const stream = (token: string): MessageUpdate => ({ type: MessageUpdateType.Stream, token });

describe("applyMessageUpdate", () => {
	it("appends a stream token to content, audits a copy, and returns the null-padded event", async () => {
		const ctx = makeCtx();
		const out = await applyMessageUpdate(stream("Hi"), ctx);

		expect(ctx.message.content).toBe("Hi");
		// audit entry is a copy with the ORIGINAL (unpadded) token, preserving ordering
		expect(ctx.message.updates).toHaveLength(1);
		expect(ctx.message.updates?.[0]).toEqual({ type: MessageUpdateType.Stream, token: "Hi" });
		// the enqueued event is padded to a fixed width (side-channel defense)
		expect(out).not.toBeNull();
		expect(out?.type).toBe(MessageUpdateType.Stream);
		expect((out as { token: string }).token).toBe("Hi".padEnd(16, "\0"));
		expect(ctx.state.lastTokenTimestamp).toBeInstanceOf(Date);
	});

	it("drops an empty stream token entirely (null result, no content/audit change)", async () => {
		const ctx = makeCtx();
		const out = await applyMessageUpdate(stream(""), ctx);

		expect(out).toBeNull();
		expect(ctx.message.content).toBe("");
		expect(ctx.message.updates).toHaveLength(0);
	});

	it("appends reasoning stream tokens to message.reasoning", async () => {
		const ctx = makeCtx();
		await applyMessageUpdate(
			{
				type: MessageUpdateType.Reasoning,
				subtype: MessageReasoningUpdateType.Stream,
				token: "think ",
			},
			ctx
		);
		await applyMessageUpdate(
			{
				type: MessageUpdateType.Reasoning,
				subtype: MessageReasoningUpdateType.Stream,
				token: "more",
			},
			ctx
		);

		expect(ctx.message.reasoning).toBe("think more");
		expect(ctx.message.content).toBe("");
	});

	it("strips <think> markers from a title and persists via saveTitle", async () => {
		const saveTitle = vi.fn().mockResolvedValue(undefined);
		const ctx = makeCtx({ saveTitle });
		await applyMessageUpdate(
			{ type: MessageUpdateType.Title, title: "<think>plan</think> A Real Title " },
			ctx
		);

		expect(saveTitle).toHaveBeenCalledExactlyOnceWith("plan A Real Title");
	});

	it("replaces content with initial + final text and flips finalAnswerReceived", async () => {
		const ctx = makeCtx({
			message: emptyMessage("partial stream"),
			initialMessageContent: "",
		});
		const out = await applyMessageUpdate(
			{ type: MessageUpdateType.FinalAnswer, text: "the final answer", interrupted: false },
			ctx
		);

		expect(ctx.message.content).toBe("the final answer");
		expect(ctx.message.interrupted).toBe(false);
		expect(ctx.state.finalAnswerReceived).toBe(true);
		// FinalAnswer is returned verbatim (not padded) so the handler can detect it
		expect(out).toEqual({
			type: MessageUpdateType.FinalAnswer,
			text: "the final answer",
			interrupted: false,
		});
	});

	it("preserves the pre-turn content prefix when splicing the final answer", async () => {
		const ctx = makeCtx({
			message: emptyMessage("EARLIER. partial"),
			initialMessageContent: "EARLIER. ",
		});
		await applyMessageUpdate(
			{ type: MessageUpdateType.FinalAnswer, text: "done", interrupted: true },
			ctx
		);

		expect(ctx.message.content).toBe("EARLIER. done");
		expect(ctx.message.interrupted).toBe(true);
	});

	it("appends a hash file entry", async () => {
		const ctx = makeCtx();
		await applyMessageUpdate(
			{ type: MessageUpdateType.File, name: "a.png", sha: "abc123", mime: "image/png" },
			ctx
		);

		expect(ctx.message.files).toEqual([
			{ type: "hash", name: "a.png", value: "abc123", mime: "image/png" },
		]);
	});

	it("merges full router metadata for a router model", async () => {
		const ctx = makeCtx({ model: { isRouter: true } });
		// route/model arrive first…
		await applyMessageUpdate(
			{ type: MessageUpdateType.RouterMetadata, route: "code", model: "big", provider: undefined },
			ctx
		);
		// …provider arrives later and must not clobber route/model
		await applyMessageUpdate(
			{ type: MessageUpdateType.RouterMetadata, route: "", model: "", provider: "hf-inference" },
			ctx
		);

		expect(ctx.message.routerMetadata).toEqual({
			route: "code",
			model: "big",
			provider: "hf-inference",
		});
	});

	it("stores provider-only metadata for a non-router model", async () => {
		const ctx = makeCtx({ model: { isRouter: false } });
		await applyMessageUpdate(
			{
				type: MessageUpdateType.RouterMetadata,
				route: "ignored",
				model: "ignored",
				provider: "hf-inference",
			},
			ctx
		);

		expect(ctx.message.routerMetadata).toEqual({ route: "", model: "", provider: "hf-inference" });
	});

	it("sets finishedStatusSent on a Status:Finished event", async () => {
		const ctx = makeCtx();
		await applyMessageUpdate(
			{ type: MessageUpdateType.Status, status: MessageUpdateStatus.Finished },
			ctx
		);
		expect(ctx.state.finishedStatusSent).toBe(true);
	});

	it("does NOT audit KeepAlive or AgentStep events (transient), but still returns them", async () => {
		const ctx = makeCtx();
		const keepAlive = await applyMessageUpdate(
			{ type: MessageUpdateType.Status, status: MessageUpdateStatus.KeepAlive },
			ctx
		);
		const agentStep = await applyMessageUpdate(
			{ type: MessageUpdateType.AgentStep, index: 0, tool: "search" },
			ctx
		);

		expect(ctx.message.updates).toHaveLength(0);
		expect(keepAlive).not.toBeNull();
		expect(agentStep).not.toBeNull();
	});

	it("records time-to-first-token exactly once across two tokens", async () => {
		const metrics: MetricsContext = {
			promptedAt: new Date(),
			labels: { model: "test" },
			model: {
				tokenCountTotal: { inc: vi.fn() },
				timeToFirstToken: { observe: vi.fn() },
				timePerOutputToken: { observe: vi.fn() },
				latency: { observe: vi.fn() },
			} as unknown as MetricsContext["model"],
		};
		const ctx = makeCtx({ metrics });

		await applyMessageUpdate(stream("a"), ctx);
		await applyMessageUpdate(stream("b"), ctx);

		expect(metrics.model.tokenCountTotal.inc).toHaveBeenCalledTimes(2);
		expect(metrics.model.timeToFirstToken.observe).toHaveBeenCalledTimes(1);
		expect(metrics.model.timePerOutputToken.observe).toHaveBeenCalledTimes(2);
		expect(ctx.state.firstTokenObserved).toBe(true);
	});
});
