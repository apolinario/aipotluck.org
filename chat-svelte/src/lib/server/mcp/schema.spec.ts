import { describe, it, expect } from "vitest";
import {
	DUMMY_PARAM,
	isNoParamTool,
	mcpToolToOpenAITool,
	stripDummyArgs,
	parseToolArgs,
	type McpTool,
} from "./schema";

const withParams: McpTool = {
	name: "translate",
	description: "Translate text.",
	inputSchema: {
		type: "object",
		properties: { text: { type: "string" }, target: { type: "string" } },
		required: ["text", "target"],
	},
};
const noParams: McpTool = {
	name: "get_status",
	description: "Service status.",
	inputSchema: { type: "object", properties: {} },
};
const noSchema: McpTool = { name: "ping" };

describe("isNoParamTool", () => {
	it("detects empty / missing properties", () => {
		expect(isNoParamTool(noParams)).toBe(true);
		expect(isNoParamTool(noSchema)).toBe(true);
		expect(isNoParamTool(withParams)).toBe(false);
	});
});

describe("mcpToolToOpenAITool", () => {
	it("passes through real params + required", () => {
		const t = mcpToolToOpenAITool(withParams);
		expect(t.type).toBe("function");
		expect(t.function.name).toBe("translate");
		const p = t.function.parameters as { properties: Record<string, unknown>; required?: string[] };
		expect(Object.keys(p.properties)).toEqual(["text", "target"]);
		expect(p.required).toEqual(["text", "target"]);
	});

	it("pads a no-param tool with the dummy arg (the no-param-tool workaround)", () => {
		const t = mcpToolToOpenAITool(noParams);
		const p = t.function.parameters as { properties: Record<string, unknown>; required?: string[] };
		expect(Object.keys(p.properties)).toEqual([DUMMY_PARAM]);
		expect(p.required).toBeUndefined(); // dummy is optional
	});

	it("pads a tool with no input schema at all", () => {
		const p = mcpToolToOpenAITool(noSchema).function.parameters as {
			properties: Record<string, unknown>;
		};
		expect(Object.keys(p.properties)).toEqual([DUMMY_PARAM]);
	});
});

describe("stripDummyArgs", () => {
	it("removes the dummy pad before the Space sees it", () => {
		expect(stripDummyArgs({ [DUMMY_PARAM]: "", text: "hi" })).toEqual({ text: "hi" });
		expect(stripDummyArgs({ text: "hi" })).toEqual({ text: "hi" }); // untouched when absent
	});
});

describe("parseToolArgs", () => {
	it("parses JSON, fails safe to {} on junk/empty", () => {
		expect(parseToolArgs('{"text":"hi"}')).toEqual({ text: "hi" });
		expect(parseToolArgs(undefined)).toEqual({});
		expect(parseToolArgs("not json")).toEqual({});
		expect(parseToolArgs("[1,2]")).toEqual({}); // array is not a param object
	});
});
