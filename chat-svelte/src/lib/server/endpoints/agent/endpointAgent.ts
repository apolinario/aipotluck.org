import { z } from "zod";
import type { Endpoint, TextGenerationStreamOutputSimplified } from "../endpoints";

/**
 * Agent endpoint — Story B (agent answers inside Gap Chat).
 *
 * Instead of calling an OpenAI model, this drives the Public AI **agent service** (the hosted
 * Apertus-hybrid backend): POST /run to submit the task, then stream GET /run/{id}/events (SSE) and
 * translate the agent's event stream into chat-ui's token stream. The agent's plan + per-step progress
 * are wrapped in a single <think>…</think> block (ChatMessage.svelte's zero-config reasoning
 * autodetection renders that as a collapsible "thinking" panel), and the verified result becomes the
 * answer. A routerMetadata chunk lights the provenance badge + the Apertus node on the StackMap.
 *
 * All the hard parts (plan/exec, bwrap sandbox, best-of-N, caps, metering, moderation) live behind the
 * agent service's HTTP boundary — this endpoint only translates transports. It never holds the upstream
 * model token; it carries only the per-deployment service token (a normal API credential).
 *
 * MVP scope (docs/agent-frontends.md §6 Story B): a free-form chat turn has no verify spec, so the
 * backend runs a single hybrid attempt (~88%), not best-of-N. The full per-step StackMap animation
 * (a dedicated AgentStep update + MapNode) is the follow-on.
 */
export const endpointAgentParametersSchema = z.object({
	weight: z.number().int().positive().default(1),
	model: z.any(),
	type: z.literal("agent"),
	/** Base URL of the agent service (e.g. https://…fly.dev or http://127.0.0.1:8751). */
	baseURL: z.string().url(),
	/** Per-user / per-deployment bearer token for the agent service (empty when its auth is disabled). */
	apiKey: z.string().default(""),
	/** Provenance label shown in the badge + StackMap model node. */
	provenanceModel: z.string().default("swiss-ai/Apertus-70B-Instruct-2509"),
	provenanceProvider: z.string().default("Infomaniak"),
	/** Cap on how long we wait on the event stream (ms); should exceed the backend wall-clock. */
	streamTimeoutMs: z.number().int().positive().default(300_000),
});

interface AgentEvent {
	type?: string;
	steps?: string[];
	attempt?: number;
	tool?: string;
	step?: number;
	summary?: string;
	text?: string;
	state?: string;
	result?: string;
	verified?: boolean;
	errors?: string[];
}

export async function endpointAgent(
	input: z.input<typeof endpointAgentParametersSchema>
): Promise<Endpoint> {
	const { baseURL, apiKey, provenanceModel, provenanceProvider, streamTimeoutMs } =
		endpointAgentParametersSchema.parse(input);

	const base = baseURL.replace(/\/$/, "");
	const headers: Record<string, string> = { "content-type": "application/json" };
	if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;

	return async function ({ messages, abortSignal }) {
		// The agent service runs one task per call; use the latest user turn as the task prompt.
		const lastUser = [...messages].reverse().find((m) => m.from === "user");
		const prompt = (lastUser?.content ?? messages[messages.length - 1]?.content ?? "").trim();

		return (async function* (): AsyncGenerator<TextGenerationStreamOutputSimplified, void, void> {
			let tokenId = 0;
			const mk = (
				text: string,
				opts: { special?: boolean; generated_text?: string | null; router?: boolean } = {}
			): TextGenerationStreamOutputSimplified =>
				({
					token: { id: tokenId++, text, logprob: 0, special: opts.special ?? false },
					generated_text: opts.generated_text ?? null,
					details: null,
					...(opts.router
						? { routerMetadata: { route: "agent", model: provenanceModel, provider: provenanceProvider } }
						: {}),
				}) as TextGenerationStreamOutputSimplified;

			// 1) submit the task
			const submit = await fetch(`${base}/run`, {
				method: "POST",
				headers,
				body: JSON.stringify({ prompt }),
				signal: abortSignal,
			});
			if (!submit.ok) {
				const body = await submit.text().catch(() => "");
				yield mk(`The agent service rejected the request (HTTP ${submit.status}). ${body}`.trim(), {
					generated_text: `agent service error ${submit.status}`,
					special: true,
				});
				return;
			}
			const taskId: string = (await submit.json())?.id;
			if (!taskId) {
				yield mk("The agent service returned no task id.", {
					generated_text: "agent service: no task id",
					special: true,
				});
				return;
			}

			// provenance first → lights the badge + the Apertus node on the StackMap
			yield mk("", { special: true, router: true });

			// 2) stream the event log and translate it to a <think> progress block + the answer.
			// The opening <think> must be STREAMED as a token (not just seeded into the accumulator), or the
			// client's live think-block autodetection won't trigger until the final answer lands.
			const full: string[] = [];
			const push = function* (s: string) {
				full.push(s);
				yield mk(s);
			};
			yield* push("<think>\n");
			yield* push("Working on it via the open agent (Apertus, hybrid)…\n");

			let answer = "";
			let thinkClosed = false;
			const closeThink = function* () {
				if (thinkClosed) return;
				thinkClosed = true;
				full.push("</think>\n");
				yield mk("</think>\n");
			};

			const ctrl = new AbortController();
			const onAbort = () => ctrl.abort();
			abortSignal?.addEventListener("abort", onAbort);
			const timeout = setTimeout(() => ctrl.abort(), streamTimeoutMs);
			try {
				const res = await fetch(`${base}/run/${taskId}/events`, { headers, signal: ctrl.signal });
				if (!res.ok || !res.body) {
					yield* closeThink();
					answer = `The agent stream could not be opened (HTTP ${res.status}).`;
					yield* push(answer);
				} else {
					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					let buf = "";
					let etype: string | null = null;
					let done = false;
					while (!done) {
						const { value, done: rd } = await reader.read();
						if (rd) break;
						buf += decoder.decode(value, { stream: true });
						// SSE frames are separated by a blank line
						let sep: number;
						while ((sep = buf.indexOf("\n\n")) !== -1) {
							const frame = buf.slice(0, sep);
							buf = buf.slice(sep + 2);
							etype = null;
							let data = "";
							for (const line of frame.split("\n")) {
								if (line.startsWith("event:")) etype = line.slice(6).trim();
								else if (line.startsWith("data:")) data += line.slice(5).trim();
							}
							if (!etype) continue;
							let ev: AgentEvent = {};
							try {
								ev = data ? (JSON.parse(data) as AgentEvent) : {};
							} catch {
								ev = {};
							}
							if (etype === "plan") {
								const steps = ev.steps ?? [];
								const attempt = ev.attempt && ev.attempt > 1 ? ` (attempt ${ev.attempt})` : "";
								yield* push(`Planned ${steps.length} step(s): ${steps.join(", ")}${attempt}\n`);
							} else if (etype === "tool_call") {
								yield* push(`→ step ${ev.step}: ${ev.tool}\n`);
							} else if (etype === "tool_result") {
								if (ev.summary) yield* push(`   ${ev.summary}\n`);
							} else if (etype === "message") {
								if (ev.text) yield* push(`note: ${ev.text}\n`);
							} else if (etype === "done") {
								yield* closeThink();
								answer =
									(ev.result ?? "").trim() ||
									(ev.state === "COMPLETED"
										? "Done."
										: `The agent did not complete (${ev.state ?? "failed"}).`);
								if (ev.state && ev.state !== "COMPLETED" && !ev.result) {
									answer = `The agent could not finish this task (${ev.state}).`;
								}
								yield mk(answer);
								full.push(answer);
								done = true;
								break;
							}
						}
					}
				}
			} finally {
				clearTimeout(timeout);
				abortSignal?.removeEventListener("abort", onAbort);
			}

			yield* closeThink();
			if (!answer) {
				answer = "The agent stream ended without a result.";
				yield mk(answer);
				full.push(answer);
			}
			// terminal chunk: full content (think block + answer) → generate.ts emits FinalAnswer; the
			// client splits the <think> block into a collapsible reasoning panel from the content itself.
			yield mk("", { special: true, generated_text: full.join("") });
		})();
	};
}
