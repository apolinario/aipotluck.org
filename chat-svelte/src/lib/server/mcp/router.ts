// Bare-prompt tool router. Given the user's message and the available MCP tools, decides on a
// CLEAN prompt (NO persona) whether a tool is needed and extracts its args. This is the layer
// our findings force: under the full persona the served model tool-calls at ~0% (the persona
// is non-proactive BY DESIGN — Alpha launch content voice rules), but on a bare prompt it
// decides + extracts well (~85%, search-decision eval; multi-tool discrimination confirmed in
// evals/tool-serving-probe). So the tool DECISION never goes through the persona-framed chat;
// it runs here, and the code invokes the chosen tool. See docs/mcp-restoration-scope.md.
import { config } from "$lib/server/config";
import { defaultModel } from "$lib/server/models";
import { parseToolArgs, stripDummyArgs } from "./schema";
import type OpenAI from "openai";

export type ToolChoice = { name: string; args: Record<string, unknown> } | null;

// A completion message's tool_calls, narrowed to what we read (kept loose so the OpenAI SDK
// response shape changes don't break this — and so it's trivially unit-testable).
type ToolCallish = {
	tool_calls?: Array<{ type?: string; function?: { name?: string; arguments?: string } }>;
};

/** Pure: pull the first function tool_call out of a completion message, parse + de-dummy its
 *  args. Null when the model chose to answer directly (no tool call). Unit-tested. */
export function extractToolChoice(message: ToolCallish | undefined): ToolChoice {
	const call = message?.tool_calls?.find((c) => c.type === "function" && c.function?.name);
	if (!call?.function?.name) return null;
	return {
		name: call.function.name,
		args: stripDummyArgs(parseToolArgs(call.function.arguments)),
	};
}

/** Decide whether to call one of `tools` for `userMessage`, on a bare prompt. Returns the
 *  chosen tool + args, or null to answer directly. Returns null (fail-open to a normal answer)
 *  on any model error — a routing failure must never break the chat. */
export async function routeToolCall(
	userMessage: string,
	tools: OpenAI.Chat.ChatCompletionTool[]
): Promise<ToolChoice> {
	if (!tools.length) return null;
	const model = defaultModel?.id ?? defaultModel?.name ?? "";
	try {
		const { OpenAI } = await import("openai");
		const client = new OpenAI({
			baseURL: config.OPENAI_BASE_URL,
			apiKey: config.OPENAI_API_KEY || config.HF_TOKEN || "sk-",
			defaultHeaders: { "User-Agent": "aipotluck-chat" },
		});
		const res = await client.chat.completions.create({
			model,
			messages: [{ role: "user", content: userMessage }], // BARE — no persona, by design
			tools,
			tool_choice: "auto",
			temperature: 0,
			max_tokens: 120,
			stream: false,
		});
		return extractToolChoice(res.choices?.[0]?.message);
	} catch {
		return null;
	}
}
