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
//                 tool-calling is unreliable. Until it is wired, "tool" degrades
//                 to the classifier so search still works.
//   "margin"    — the PROVEN prod path for Apertus-70B-2509 (weak at native
//                 tool-calling): the model decides via a yes/no classifier read by
//                 LOGPROB MARGIN (decideSearchViaMargin). Unlike model/tool it is
//                 NOT OR'd with the recency regex — the regex's false-positives would
//                 break its 100% specificity; the heuristic is only an on-error
//                 fallback. Threshold via SEARCH_MARGIN_THRESHOLD (default -0.75).
//                 Validated on evals/search-decision: held-out 85% recall / 100%
//                 specificity on the served 70B (regex configs overfit; margin didn't).
//
// Single switch for the alpha. To make it deploy-tunable without a code change,
// read PUBLIC_SEARCH_TRIGGER here and fall back to this default.
export type SearchTriggerStrategy = "heuristic" | "model" | "tool" | "margin";

// Code default = "heuristic" — the prod-SAFE default. Deployments select the
// active strategy via the PUBLIC_SEARCH_TRIGGER env var (resolved through
// resolveTriggerStrategy below), so flipping to model/tool is a config change,
// never a code edit that could surprise a deploy. Current local dogfood runs
// PUBLIC_SEARCH_TRIGGER=margin on the served Apertus-70B-2509 — the proven prod
// path (logprob-margin classifier, 100% held-out specificity; see
// decideSearchViaMargin). Earlier (2026-06-18) a probe ran PUBLIC_SEARCH_TRIGGER=
// tool on an Apertus 1.5 8B sft-dpo-TOOLS checkpoint and confirmed it emits clean
// OpenAI tool_calls; that path is retained but NOT the active strategy (the 70B is
// weak at native tool-calling, which is why margin replaced it). ("model" = the
// cheaper yes/no classifier path, kept for any non-tools checkpoint; see
// searchDecision.ts.)
export const SEARCH_TRIGGER_STRATEGY: SearchTriggerStrategy = "heuristic";

/**
 * Resolve a raw env value (PUBLIC_SEARCH_TRIGGER) into a valid strategy, falling
 * back to the safe code default for unset/unknown values. Pure + exported so the
 * client (via layout data) and the server endpoint resolve it identically.
 */
export function resolveTriggerStrategy(raw?: string | null): SearchTriggerStrategy {
	const v = (raw ?? "").trim().toLowerCase();
	return v === "heuristic" || v === "model" || v === "tool" || v === "margin"
		? v
		: SEARCH_TRIGGER_STRATEGY;
}

/**
 * Whether the client should ask the server for a model-driven decision (vs. the recency
 * heuristic alone). True for "model", "tool", and "margin". For model/tool the heuristic is a
 * fast-path OR; for margin the server decision is PRIMARY (see shouldRunSearch).
 */
export function usesModelClassifier(
	strategy: SearchTriggerStrategy = SEARCH_TRIGGER_STRATEGY
): boolean {
	return strategy === "model" || strategy === "tool" || strategy === "margin";
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
	marginOk?: boolean;
	strategy?: SearchTriggerStrategy;
}): boolean {
	const strategy = opts.strategy ?? SEARCH_TRIGGER_STRATEGY;
	if (strategy === "margin") {
		// Margin is the PRIMARY decider (100% specificity on held-out eval) — NOT OR'd with the
		// recency regex (that OR tanked specificity 100→50). classifierHit carries the margin
		// verdict; only on a FAILED margin call (marginOk === false) do we fall back to the
		// recency heuristic so search still works.
		return opts.marginOk === false ? opts.heuristicHit : !!opts.classifierHit;
	}
	if (opts.heuristicHit) return true;
	if (usesModelClassifier(strategy)) {
		return !!opts.classifierHit;
	}
	return false;
}
