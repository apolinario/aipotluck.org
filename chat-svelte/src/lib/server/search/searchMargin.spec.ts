import { describe, it, expect } from "vitest";
import { marginFromLogprobs, type TopLogprob } from "./searchMargin";

// The margin gate decides search from the classifier's first-token top_logprobs by P(yes)−P(no)
// vs a threshold. These pin: casing/whitespace folding, single-letter Y/N, mass-summing across
// variants, the threshold semantics (lower = more recall), and graceful degeneracy (empty → no).
// lp = ln(p); use ln() so the intent (probabilities) is legible.
const lp = (p: number) => Math.log(p);

describe("marginFromLogprobs", () => {
	it("searches when yes outweighs no (margin ≥ threshold 0)", () => {
		const top: TopLogprob[] = [
			{ token: "Yes", logprob: lp(0.7) },
			{ token: "No", logprob: lp(0.2) },
		];
		const v = marginFromLogprobs(top, 0);
		expect(v.shouldSearch).toBe(true);
		expect(v.margin).toBeCloseTo(0.5, 5);
	});

	it("skips when no outweighs yes at threshold 0", () => {
		const top: TopLogprob[] = [
			{ token: "No", logprob: lp(0.62) },
			{ token: "Yes", logprob: lp(0.3) },
		];
		expect(marginFromLogprobs(top, 0).shouldSearch).toBe(false);
	});

	it("a lower (negative) threshold searches MORE — the recall knob", () => {
		// no leads yes by 0.3; at -0.75 we still search (conservative recall bias), at 0 we don't.
		const top: TopLogprob[] = [
			{ token: "No", logprob: lp(0.6) },
			{ token: "Yes", logprob: lp(0.3) },
		];
		expect(marginFromLogprobs(top, 0).shouldSearch).toBe(false);
		expect(marginFromLogprobs(top, -0.75).shouldSearch).toBe(true);
	});

	it("folds casing + leading whitespace and sums mass across variants", () => {
		const top: TopLogprob[] = [
			{ token: " yes", logprob: lp(0.3) },
			{ token: "Yes", logprob: lp(0.25) },
			{ token: "no", logprob: lp(0.2) },
		];
		const v = marginFromLogprobs(top, 0);
		expect(v.pYes).toBeCloseTo(0.55, 5);
		expect(v.pNo).toBeCloseTo(0.2, 5);
		expect(v.shouldSearch).toBe(true);
	});

	it("handles single-letter Y / N tokens", () => {
		expect(marginFromLogprobs([{ token: "Y", logprob: lp(0.9) }], 0).shouldSearch).toBe(true);
		expect(marginFromLogprobs([{ token: "N", logprob: lp(0.9) }], 0).shouldSearch).toBe(false);
	});

	it("empty / degenerate top_logprobs → margin 0 (prod's ok-gate handles the fallback)", () => {
		expect(marginFromLogprobs([], -0.75).margin).toBe(0);
		expect(marginFromLogprobs(undefined, -0.75).margin).toBe(0);
		// a token with no yes/no signal contributes no mass → margin 0
		expect(marginFromLogprobs([{ token: "maybe", logprob: lp(0.9) }], 0).margin).toBe(0);
		// at a positive threshold a 0-margin does NOT search (the boundary ≥ searches only at T≤0;
		// in prod decideSearchViaMargin returns ok:false on empty logprobs so this never decides live)
		expect(marginFromLogprobs([{ token: "maybe", logprob: lp(0.9) }], 0.01).shouldSearch).toBe(
			false
		);
	});
});
