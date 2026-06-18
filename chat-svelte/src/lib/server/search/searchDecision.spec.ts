import { describe, it, expect } from "vitest";
import { parseClassifierVerdict } from "./searchDecision";

// The verdict parse is the load-bearing bit of the model classifier: it must
// fail CLOSED (→ no search) on anything that isn't a clean leading "yes", since
// a false-positive search costs latency + injects sources, while abstaining
// just answers from training.
describe("parseClassifierVerdict", () => {
	it("accepts a clean yes (any case, trailing punctuation/whitespace)", () => {
		expect(parseClassifierVerdict("yes")).toBe(true);
		expect(parseClassifierVerdict("Yes")).toBe(true);
		expect(parseClassifierVerdict("YES")).toBe(true);
		expect(parseClassifierVerdict("  yes  ")).toBe(true);
		expect(parseClassifierVerdict("yes.")).toBe(true);
		expect(parseClassifierVerdict("yes, current info needed")).toBe(true);
	});

	it("rejects no and fails closed on rambling / empty / leading non-yes", () => {
		expect(parseClassifierVerdict("no")).toBe(false);
		expect(parseClassifierVerdict("No.")).toBe(false);
		expect(parseClassifierVerdict("")).toBe(false);
		expect(parseClassifierVerdict(undefined)).toBe(false);
		expect(parseClassifierVerdict("I think yes")).toBe(false);
		expect(parseClassifierVerdict("maybe")).toBe(false);
		// must be the whole word, not a prefix like "yesterday"
		expect(parseClassifierVerdict("yesterday's news")).toBe(false);
	});
});
