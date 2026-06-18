// How the app decides a chat turn needs open-web grounding. Three strategies:
//
//   "heuristic" — the recency regex (isRecencyQuery) is the only decider.
//   "model"     — the recency regex is a free fast-path; when it abstains, a
//                 server-side classifier (searchDecision.ts) lets the MODEL
//                 decide. This is "the model doing it" without the unreliable
//                 mid-stream tool-call parsing.
//   "tool"      — real OpenAI tool-calling (the model emits a web_search call).
//                 Scaffolded only (see $lib/server/search/toolSearch.ts); the
//                 tool loop was stripped from this fork and Apertus's
//                 tool-calling is unreliable until 1.5. Until it is wired,
//                 "tool" degrades to the classifier so search still works.
//
// Single switch for the alpha. To make it deploy-tunable without a code change,
// read PUBLIC_SEARCH_TRIGGER here and fall back to this default.
export type SearchTriggerStrategy = "heuristic" | "model" | "tool";

// Default = "heuristic" for now. Empirical finding (browser probe, 2026-06-18,
// Apertus 70B): the model classifier discriminates timeless vs current well,
// BUT under-triggers on non-keyword live-data queries ("price of Bitcoin?",
// "who is the secretary-general of NATO?") — the model is confidently unaware
// its knowledge is stale. In testing it added ZERO net coverage over the regex
// while adding a pre-answer round-trip on every non-recency turn. So the
// classifier ships built + tested + ready, but OFF, until Apertus 1.5 is
// re-probed (rerun the same queries; flip to "model" once it expands coverage).
export const SEARCH_TRIGGER_STRATEGY: SearchTriggerStrategy = "heuristic";

/**
 * Whether the model classifier should arbitrate when the recency heuristic
 * abstains. True for "model" and (until tool-calling is wired) "tool".
 */
export function usesModelClassifier(
	strategy: SearchTriggerStrategy = SEARCH_TRIGGER_STRATEGY
): boolean {
	return strategy === "model" || strategy === "tool";
}

/**
 * Pure composition of the two signals + strategy. The classifier result is
 * passed in (resolved by the caller, since it needs a server round-trip) so
 * this stays pure and unit-testable. The heuristic always wins as a fast-path;
 * the classifier only matters when the heuristic abstained and the strategy
 * enables it.
 */
export function shouldRunSearch(opts: {
	heuristicHit: boolean;
	classifierHit?: boolean;
	strategy?: SearchTriggerStrategy;
}): boolean {
	if (opts.heuristicHit) return true;
	if (usesModelClassifier(opts.strategy ?? SEARCH_TRIGGER_STRATEGY)) {
		return !!opts.classifierHit;
	}
	return false;
}
