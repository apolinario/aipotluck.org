import { describe, it, expect, vi, afterEach } from "vitest";
import { endpointAgent } from "./endpointAgent";

// Pure unit test for the agent endpoint's SSE→chunk translation (no network). Complements the live spec
// (which auto-skips in CI): this one locks the contract chat-ui's generate.ts depends on — provenance
// chunk, a streamed <think> block, per-step lines, and a terminal generated_text carrying the answer.

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
	const enc = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const f of frames) controller.enqueue(enc.encode(f));
			controller.close();
		},
	});
}

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

afterEach(() => vi.unstubAllGlobals());

describe("endpointAgent (unit, mocked agent service)", () => {
	it("submits with synthesize:true and translates the SSE stream into chat-ui chunks", async () => {
		const frames = [
			frame("state", { state: "working" }),
			frame("plan", { attempt: 1, steps: ["tool", "write"] }),
			frame("tool_call", { tool: "tool", step: 0 }),
			frame("tool_result", { ok: true, step: 0, summary: "5 bytes" }),
			frame("tool_call", { tool: "write", step: 1 }),
			frame("tool_result", { ok: true, step: 1, summary: "2 bytes" }),
			frame("done", { state: "COMPLETED", result: "There are 3 files.", verified: false }),
		];
		const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
			const u = String(url);
			if (u.endsWith("/run")) {
				return { ok: true, status: 200, json: async () => ({ id: "t1" }), text: async () => "" } as Response;
			}
			if (u.includes("/run/t1/events")) {
				return { ok: true, status: 200, body: sseStream(frames) } as unknown as Response;
			}
			throw new Error(`unexpected url ${u} ${init?.method ?? ""}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const factory = await endpointAgent({
			type: "agent",
			baseURL: "http://agent.test",
			apiKey: "tok",
			model: {},
		});
		const stream = await factory({
			messages: [{ from: "user", content: "how many files?" }],
		} as Parameters<typeof factory>[0]);

		const chunks: {
			token: { text: string };
			generated_text: string | null;
			routerMetadata?: { model?: string };
			agentStep?: { index: number; tool: string; total?: number };
		}[] = [];
		for await (const c of stream) chunks.push(c as (typeof chunks)[number]);

		// submit: POST /run with the prompt + synthesize:true + bearer auth
		const submitCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/run"));
		expect(submitCall).toBeDefined();
		const body = JSON.parse((submitCall![1] as RequestInit).body as string);
		expect(body).toMatchObject({ prompt: "how many files?", synthesize: true });
		expect((submitCall![1] as RequestInit).headers).toMatchObject({ authorization: "Bearer tok" });

		const text = chunks.map((c) => c.token.text).join("");
		const finalChunk = chunks.find((c) => c.generated_text);

		expect(chunks.some((c) => c.routerMetadata?.model)).toBe(true); // provenance → badge + StackMap node
		expect(text).toContain("<think>");
		expect(text).toContain("</think>");
		expect(text).toContain("step 0: tool");
		expect(text).toContain("5 bytes");
		expect(text).toContain("There are 3 files."); // the answer streams after </think>
		expect(finalChunk?.generated_text).toContain("<think>");
		expect(finalChunk?.generated_text).toContain("There are 3 files.");

		// per-step live-stack beat: one agentStep chunk per tool_call, carrying the step index, tool name,
		// and the plan's total step count (→ generate.ts forwards as MessageUpdateType.AgentStep → the
		// client beats the Hermes node on the map). Two tool_calls in the canned SSE → two agentStep chunks.
		const steps = chunks.filter((c) => c.agentStep).map((c) => c.agentStep!);
		expect(steps).toHaveLength(2);
		expect(steps[0]).toMatchObject({ index: 0, tool: "tool", total: 2 });
		expect(steps[1]).toMatchObject({ index: 1, tool: "write", total: 2 });
	});

	// Consumer half of the agent-service "Contract (BINDING)" (docs/streaming-spec.md). The done-frame
	// `state` is the UPPERCASE State enum value; this endpoint compares against "COMPLETED". These pin that
	// dependency so a backend casing change (or a refactor here) is caught cross-repo, not in prod.
	async function runWithDone(done: Record<string, unknown>) {
		const frames = [frame("plan", { attempt: 1, steps: ["write"] }), frame("done", done)];
		const fetchMock = vi.fn(async (url: string | URL) => {
			const u = String(url);
			if (u.endsWith("/run"))
				return { ok: true, status: 200, json: async () => ({ id: "t1" }), text: async () => "" } as Response;
			if (u.includes("/run/t1/events"))
				return { ok: true, status: 200, body: sseStream(frames) } as unknown as Response;
			throw new Error(`unexpected url ${u}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const factory = await endpointAgent({ type: "agent", baseURL: "http://agent.test", model: {} });
		const stream = await factory({ messages: [{ from: "user", content: "go" }] } as Parameters<
			typeof factory
		>[0]);
		const chunks: { token: { text: string }; generated_text: string | null }[] = [];
		for await (const c of stream) chunks.push(c as (typeof chunks)[number]);
		return chunks.find((c) => c.generated_text)?.generated_text ?? "";
	}

	it("treats UPPERCASE COMPLETED (no result) as success — casing is load-bearing", async () => {
		const upper = await runWithDone({ state: "COMPLETED", verified: true });
		expect(upper).toContain("Done.");
		expect(upper).not.toContain("could not finish");
		// the same frame with lowercase casing would be read as a non-completion — proving the consumer
		// depends on the contract's UPPERCASE enum, so a backend that lowercased it would break here first.
		const lower = await runWithDone({ state: "completed", verified: true });
		expect(lower).toContain("could not finish");
	});

	it("handles a FAILED terminal gracefully (no throw, honest message)", async () => {
		const failed = await runWithDone({ state: "FAILED", result: null });
		expect(failed).toContain("could not finish");
		expect(failed).toContain("FAILED");
	});

	it("surfaces a submit failure as an answer instead of throwing", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: false,
			status: 503,
			json: async () => ({}),
			text: async () => "upstream down",
		}) as Response);
		vi.stubGlobal("fetch", fetchMock);

		const factory = await endpointAgent({ type: "agent", baseURL: "http://agent.test", model: {} });
		const stream = await factory({ messages: [{ from: "user", content: "hi" }] } as Parameters<
			typeof factory
		>[0]);
		const chunks: { token: { text: string }; generated_text: string | null }[] = [];
		for await (const c of stream) chunks.push(c as (typeof chunks)[number]);

		const finalChunk = chunks.find((c) => c.generated_text);
		expect(finalChunk?.generated_text).toContain("503");
		expect(chunks.map((c) => c.token.text).join("")).toContain("503");
	});
});
