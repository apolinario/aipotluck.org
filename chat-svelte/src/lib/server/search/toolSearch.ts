// SCAFFOLD for model TOOL-CALLING web search (trigger strategy "tool").
//
// NOT WIRED YET. The OpenAI tool loop was intentionally stripped from this fork
// (see endpointOai.ts "no tool call ids", and textGeneration/generate.ts has no
// tool_call handling), and Apertus's tool-calling is unreliable until 1.5. Until
// TOOL_CALLING_WIRED flips to true, the "tool" strategy degrades to the
// pre-flight classifier (searchDecision.ts) so search still works today.
//
// This file exists so the contract is reviewable now and the eventual wiring is
// mechanical when Apertus 1.5 lands and we want to dogfood real tool-calling.

export const TOOL_CALLING_WIRED = false;

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
