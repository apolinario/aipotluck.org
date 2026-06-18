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

// Code default = "heuristic" — the prod-SAFE default. Deployments select the
// active strategy via the PUBLIC_SEARCH_TRIGGER env var (resolved through
// resolveTriggerStrategy below), so flipping to model/tool is a config change,
// never a code edit that could surprise a deploy. Local dogfood (2026-06-18)
// runs PUBLIC_SEARCH_TRIGGER=tool on the Apertus 1.5 8B sft-dpo-TOOLS checkpoint:
// the probe confirmed it emits clean OpenAI tool_calls (recency → web_search with
// its own query; timeless → answers directly), so the model itself decides when
// to search. The recency heuristic stays as the safety net (OR'd in) that catches
// any false-negative the tool misses; in the ideal end-state the tool never misses
// and the net is redundant. ("model" = the cheaper yes/no classifier path, kept
// for the non-tools checkpoint; see searchDecision.ts.)
export const SEARCH_TRIGGER_STRATEGY: SearchTriggerStrategy = "heuristic";

/**
 * Resolve a raw env value (PUBLIC_SEARCH_TRIGGER) into a valid strategy, falling
 * back to the safe code default for unset/unknown values. Pure + exported so the
 * client (via layout data) and the server endpoint resolve it identically.
 */
export function resolveTriggerStrategy(raw?: string | null): SearchTriggerStrategy {
	const v = (raw ?? "").trim().toLowerCase();
	return v === "heuristic" || v === "model" || v === "tool" ? v : SEARCH_TRIGGER_STRATEGY;
}

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
