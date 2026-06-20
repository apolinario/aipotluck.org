import { describe, it, expect } from "vitest";
import { extractToolChoice } from "./router";
import { DUMMY_PARAM } from "./schema";

describe("extractToolChoice", () => {
	it("extracts the first function tool_call + parses args", () => {
		const choice = extractToolChoice({
			tool_calls: [
				{
					type: "function",
					function: { name: "translate", arguments: '{"text":"hi","target":"fr"}' },
				},
			],
		});
		expect(choice).toEqual({ name: "translate", args: { text: "hi", target: "fr" } });
	});

	it("strips the no-params dummy pad from the args", () => {
		const choice = extractToolChoice({
			tool_calls: [
				{ type: "function", function: { name: "get_status", arguments: `{"${DUMMY_PARAM}":""}` } },
			],
		});
		expect(choice).toEqual({ name: "get_status", args: {} });
	});

	it("returns null when the model answered directly (no tool_calls)", () => {
		expect(extractToolChoice({})).toBeNull();
		expect(extractToolChoice(undefined)).toBeNull();
		expect(extractToolChoice({ tool_calls: [] })).toBeNull();
	});

	it("ignores non-function / nameless calls", () => {
		expect(extractToolChoice({ tool_calls: [{ type: "custom" }] })).toBeNull();
		expect(extractToolChoice({ tool_calls: [{ type: "function", function: {} }] })).toBeNull();
	});

	it("fails safe to {} args on malformed JSON", () => {
		const choice = extractToolChoice({
			tool_calls: [{ type: "function", function: { name: "x", arguments: "not json" } }],
		});
		expect(choice).toEqual({ name: "x", args: {} });
	});
});
