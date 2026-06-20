import { describe, it, expect } from "vitest";
import {
	usesModelClassifier,
	shouldRunSearch,
	resolveTriggerStrategy,
	SEARCH_TRIGGER_STRATEGY,
} from "./triggerStrategy";

describe("resolveTriggerStrategy — env value → strategy", () => {
	it("accepts the three valid strategies (case/space-insensitive)", () => {
		expect(resolveTriggerStrategy("tool")).toBe("tool");
		expect(resolveTriggerStrategy("MODEL")).toBe("model");
		expect(resolveTriggerStrategy("  heuristic ")).toBe("heuristic");
	});
	it("falls back to the safe code default for unset/unknown values", () => {
		expect(resolveTriggerStrategy(undefined)).toBe(SEARCH_TRIGGER_STRATEGY);
		expect(resolveTriggerStrategy("")).toBe(SEARCH_TRIGGER_STRATEGY);
		expect(resolveTriggerStrategy("agentic")).toBe(SEARCH_TRIGGER_STRATEGY);
		// the safe default is heuristic — never silently enable model calls
		expect(SEARCH_TRIGGER_STRATEGY).toBe("heuristic");
	});
});

describe("usesModelClassifier", () => {
	it("is true for model and tool strategies", () => {
		expect(usesModelClassifier("model")).toBe(true);
		// "tool" degrades to the classifier until tool-calling is wired.
		expect(usesModelClassifier("tool")).toBe(true);
	});
	it("is false for the heuristic-only strategy", () => {
		expect(usesModelClassifier("heuristic")).toBe(false);
	});
});

describe("shouldRunSearch — signal composition", () => {
	it("the heuristic is an always-on fast-path (searches regardless of strategy)", () => {
		expect(shouldRunSearch({ heuristicHit: true, strategy: "heuristic" })).toBe(true);
		expect(shouldRunSearch({ heuristicHit: true, strategy: "model" })).toBe(true);
		// Heuristic wins even if the classifier (somehow) said no.
		expect(shouldRunSearch({ heuristicHit: true, classifierHit: false, strategy: "model" })).toBe(
			true
		);
	});

	it("under heuristic strategy, a heuristic miss never searches (classifier ignored)", () => {
		expect(shouldRunSearch({ heuristicHit: false, strategy: "heuristic" })).toBe(false);
		expect(
			shouldRunSearch({ heuristicHit: false, classifierHit: true, strategy: "heuristic" })
		).toBe(false);
	});

	it("under model strategy, a heuristic miss defers to the classifier", () => {
		expect(shouldRunSearch({ heuristicHit: false, classifierHit: true, strategy: "model" })).toBe(
			true
		);
		expect(shouldRunSearch({ heuristicHit: false, classifierHit: false, strategy: "model" })).toBe(
			false
		);
		// classifierHit undefined (didn't run / failed) → no search.
		expect(shouldRunSearch({ heuristicHit: false, strategy: "model" })).toBe(false);
	});

	// "margin" — the proven 70B path. The margin verdict (classifierHit) is PRIMARY; unlike
	// model/tool it is NOT OR'd with the recency heuristic (the eval showed that OR tanks
	// specificity). The heuristic is only used when the margin call failed (marginOk === false).
	it("under margin strategy, the margin verdict decides — heuristic is NOT OR'd in", () => {
		// margin says search → search.
		expect(shouldRunSearch({ heuristicHit: false, classifierHit: true, strategy: "margin" })).toBe(
			true
		);
		// KEY: heuristic hits but margin says NO → DO NOT search (no OR; preserves 100% specificity).
		expect(shouldRunSearch({ heuristicHit: true, classifierHit: false, strategy: "margin" })).toBe(
			false
		);
	});

	it("under margin strategy, a failed margin call (marginOk:false) falls back to the heuristic", () => {
		expect(
			shouldRunSearch({
				heuristicHit: true,
				classifierHit: false,
				marginOk: false,
				strategy: "margin",
			})
		).toBe(true);
		expect(
			shouldRunSearch({
				heuristicHit: false,
				classifierHit: false,
				marginOk: false,
				strategy: "margin",
			})
		).toBe(false);
		// marginOk omitted (defaults true) → trust the margin verdict.
		expect(shouldRunSearch({ heuristicHit: true, classifierHit: false, strategy: "margin" })).toBe(
			false
		);
	});
});
