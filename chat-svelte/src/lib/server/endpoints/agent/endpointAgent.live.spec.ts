import { describe, it, expect } from "vitest";
import { endpointAgent } from "./endpointAgent";

// LIVE integration test for Story B's agent endpoint. It drives the REAL endpoint generator against a
// REAL local agent service (which itself calls real Apertus on Infomaniak), asserting the chunk stream
// chat-ui's generate.ts consumes: a routerMetadata chunk (provenance), a <think>…</think> progress block,
// >=1 tool step, and a non-empty final answer. Requires a running agent service reachable at
// AGENT_SERVICE_URL (default http://127.0.0.1:8751) — see the agent-service repo for how to boot it.
// Skipped automatically if AGENT_SERVICE_URL/the default local service isn't reachable.
const BASE = process.env.AGENT_SERVICE_URL || "http://127.0.0.1:8751";

const reachable = await fetch(`${BASE}/healthz`)
	.then((r) => r.ok)
	.catch(() => false);

describe.skipIf(!reachable)("endpointAgent (live, against a local agent service)", () => {
	it(
		"streams provenance + a <think> progress block + a final answer",
		async () => {
			const factory = await endpointAgent({ type: "agent", baseURL: BASE, apiKey: "", model: {} });
			const stream = await factory({
				messages: [
					{
						from: "user",
						content:
							"Using the terminal tool only: create three files a.py, b.py and c.py, count the .py " +
							"files and write just that integer to r.txt, then read it back.",
					},
				],
			} as Parameters<typeof factory>[0]);

			const chunks: Awaited<ReturnType<typeof factory>> extends AsyncGenerator<infer T> ? T[] : never[] =
				[] as never[];
			for await (const c of stream) chunks.push(c);

			const text = chunks.map((c) => c.token.text).join("");
			const finalChunk = chunks.find((c) => c.generated_text);
			const hasProvenance = chunks.some(
				(c) => (c as { routerMetadata?: { model?: string } }).routerMetadata?.model
			);

			// log what we got so a human watching the run sees the real stream
			console.log("[live] chunks:", chunks.length, "| provenance:", hasProvenance);
			console.log("[live] final content:\n" + (finalChunk?.generated_text ?? "(none)"));

			expect(hasProvenance).toBe(true); // → ProvenanceBadge + StackMap Apertus node
			expect(text).toContain("<think>");
			expect(text).toContain("</think>");
			expect(text).toMatch(/step \d+:/); // at least one tool step narrated
			expect(finalChunk).toBeDefined();
			expect((finalChunk?.generated_text ?? "").length).toBeGreaterThan(0);
			expect(finalChunk?.generated_text).toContain("</think>"); // think block carried into final content
		},
		240_000
	);
});
