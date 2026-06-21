import { describe, it, expect } from "vitest";
import { parseClassifierVerdict, parseToolDecision } from "./searchDecision";

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

// The tool-decision parse turns the model's OpenAI tool_calls into {shouldSearch,
// query}. A web_search call → search (with the model's query when present); no
// call → no search. Shape mirrors the live probe (an Apertus tool-calling checkpoint).
describe("parseToolDecision", () => {
	const webSearchCall = (args: string) => [
		{ id: "x", type: "function", function: { name: "web_search", arguments: args } },
	];

	it("a web_search call with a query → search, carrying the model's query", () => {
		expect(parseToolDecision(webSearchCall('{"query": "latest news EU AI Act 2024"}'))).toEqual({
			shouldSearch: true,
			query: "latest news EU AI Act 2024",
		});
	});

	it("no tool call → no search (model answered from training)", () => {
		expect(parseToolDecision(null)).toEqual({ shouldSearch: false });
		expect(parseToolDecision([])).toEqual({ shouldSearch: false });
		expect(parseToolDecision(undefined)).toEqual({ shouldSearch: false });
	});

	it("only web_search counts — an unrelated tool call does not trigger search", () => {
		expect(parseToolDecision([{ function: { name: "some_other_tool", arguments: "{}" } }])).toEqual(
			{ shouldSearch: false }
		);
	});

	it("called but malformed/empty args → search, no query (caller falls back to raw text)", () => {
		expect(parseToolDecision(webSearchCall("not json"))).toEqual({ shouldSearch: true });
		expect(parseToolDecision(webSearchCall('{"query": "   "}'))).toEqual({ shouldSearch: true });
		expect(parseToolDecision(webSearchCall("{}"))).toEqual({ shouldSearch: true });
	});
});
