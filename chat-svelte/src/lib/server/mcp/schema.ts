// MCP tool definitions <-> OpenAI function-tool schemas.
//
// Bakes in the VERIFIED workaround for the Apertus "tools without parameters" bug
// (evals/tool-serving-probe): a tool whose input schema has no/empty properties makes the
// served model emit a malformed call (leaks <|tools_prefix|>). Padding the schema with one
// dummy param fixes it — the model emits a clean parseable call; we strip the dummy before
// the args reach the MCP server. So a no-arg Space tool is callable on our serving as-is.
import type OpenAI from "openai";

// Minimal shape of a tool from the SDK's client.listTools().
export type McpTool = {
	name: string;
	description?: string;
	inputSchema?: {
		type?: string;
		properties?: Record<string, unknown>;
		required?: string[];
	};
};

// Distinctive name (unlikely to collide with a real Space param) for the dummy pad.
export const DUMMY_PARAM = "_noop";

/** True when the tool advertises no input parameters — the Apertus bug trigger. */
export function isNoParamTool(tool: McpTool): boolean {
	const props = tool.inputSchema?.properties;
	return !props || Object.keys(props).length === 0;
}

/** MCP tool -> OpenAI function tool. No-param tools get one dummy optional arg so the served
 *  model emits a parseable tool_call (see file header). */
export function mcpToolToOpenAITool(tool: McpTool): OpenAI.Chat.ChatCompletionTool {
	const parameters = isNoParamTool(tool)
		? {
				type: "object",
				properties: {
					[DUMMY_PARAM]: { type: "string", description: "ignored; leave empty" },
				},
			}
		: {
				type: "object",
				properties: tool.inputSchema?.properties ?? {},
				...(tool.inputSchema?.required?.length ? { required: tool.inputSchema.required } : {}),
			};
	return {
		type: "function",
		function: {
			name: tool.name,
			description: tool.description ?? "",
			parameters,
		},
	};
}

/** Drop the dummy pad (if present) from the model's tool-call args before invoking the real
 *  MCP tool — the Space never sees it. */
export function stripDummyArgs(args: Record<string, unknown>): Record<string, unknown> {
	if (!(DUMMY_PARAM in args)) return args;
	const rest = { ...args };
	delete rest[DUMMY_PARAM];
	return rest;
}

/** Parse the JSON arguments string from a model tool_call into an object (safe: {} on junk). */
export function parseToolArgs(raw: string | undefined): Record<string, unknown> {
	if (!raw) return {};
	try {
		const v = JSON.parse(raw);
		return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}
