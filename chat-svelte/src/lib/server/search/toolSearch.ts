// Model TOOL-CALLING web search (trigger strategy "tool").
//
// WIRED (2026-06-18, Commit A) for the DECISION step: Apertus 1.5 8B sft-dpo-tools
// emits clean OpenAI tool_calls, so searchDecision.decideSearchViaTool advertises
// WEB_SEARCH_TOOL and lets the model decide + author the query. The chat answer is
// still produced by the existing grounded-streaming path (run openSearch with the
// model's query, inject evidence), so the streaming tool-result loop did NOT need
// re-architecting for this step.
//
// STILL DEFERRED to a later commit (with the MCP subsystem for the HF Spaces
// integration): the full in-stream tool loop — parsing tool_calls deltas mid-
// stream and continuing the completion with tool-role messages — which is what
// multi-step / MCP tools require. endpointOai.ts still sends no `tools` and
// generate.ts has no in-stream tool_call handling; that's the Commit B scope.

export const TOOL_CALLING_WIRED = true;

/**
 * The function/tool schema we will advertise to the model once wired. Shape
 * matches OpenAI's tools[] entry. Kept here (not inlined at the call site) so
 * the search contract — open-knowledge only, single query string — is explicit.
 */
export const WEB_SEARCH_TOOL = {
	type: "function",
	function: {
		name: "web_search",
		description:
			"Search open knowledge bases (Wikipedia + Marginalia) for current or external information beyond your training data. Use only when the answer needs recent facts, live data, or anything you cannot reliably know. Returns numbered sources to cite.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "A focused search query capturing what to look up.",
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
} as const;

// Wiring checklist (when Apertus 1.5 proves tool-calling reliable):
//   1. Pass [WEB_SEARCH_TOOL] as `tools` in the endpointOai request body, gated
//      on TOOL_CALLING_WIRED + strategy === "tool".
//   2. Parse streamed `tool_calls` deltas in endpointOai / generate.ts and
//      accumulate the arguments JSON.
//   3. On a web_search call: run openSearch(args.query), append a tool-role
//      message carrying the numbered evidence, and continue the completion
//      (the classic tool loop) so the model answers grounded + cites [n].
//   4. Emit the SAME provenance the orchestrated path emits — the data-sources
//      message part + the ap:flash["websearch"] map event — so the "Under the
//      hood" map stays honest (a node lights only when a search actually ran).
export function runToolDrivenSearch(): never {
	throw new Error(
		"tool-driven web search is not wired yet (TOOL_CALLING_WIRED=false); the 'tool' strategy uses the classifier in searchDecision.ts"
	);
}
