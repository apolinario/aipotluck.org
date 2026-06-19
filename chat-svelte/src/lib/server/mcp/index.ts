// MCP orchestration — the single entry point the chat flow calls per turn.
//
//   maybeRunMcpTool(userMessage):
//     reads the configured Space MCP URL → connects → the bare router decides + extracts →
//     invokes the chosen tool → returns its result for the answer to ground on.
//
// FAIL-OPEN everywhere: MCP is additive. No Space configured, no tool chosen, or any failure
// (connect / route / call) → null, and the chat answers normally. A tool integration must
// never break or block an answer. The tool DECISION runs on a bare prompt (see router.ts);
// nothing here goes through the persona. See docs/mcp-restoration-scope.md.
import { connectMcp } from "./client";
import { routeToolCall } from "./router";
import { config } from "$lib/server/config";
import { logger } from "$lib/server/logger";

export type McpToolResult = {
	tool: string;
	args: Record<string, unknown>;
	result: string;
};

// SPACE_MCP_URL isn't in the committed .env, so read via Reflect.get to avoid the ConfigProxy
// typecheck error on unset keys (same pattern as MODEL_ALLOWLIST / RERANK_MODEL).
function spaceMcpUrl(): string | undefined {
	const url = Reflect.get(config, "SPACE_MCP_URL") as string | undefined;
	return url?.trim() || undefined;
}

/** Whether an MCP Space is wired (gates the feature + the map node). */
export function mcpEnabled(): boolean {
	return spaceMcpUrl() !== undefined;
}

/** Run an MCP tool for this turn if one is warranted; null to answer normally. Never throws. */
export async function maybeRunMcpTool(userMessage: string): Promise<McpToolResult | null> {
	const url = spaceMcpUrl();
	if (!url) return null;

	let conn: Awaited<ReturnType<typeof connectMcp>>;
	try {
		conn = await connectMcp(url);
	} catch (e) {
		logger.warn(e, "[mcp] connect failed; answering without tools");
		return null;
	}

	try {
		const choice = await routeToolCall(userMessage, conn.openaiTools);
		if (!choice) return null;
		const result = await conn.call(choice.name, choice.args);
		return { tool: choice.name, args: choice.args, result };
	} catch (e) {
		logger.warn(e, "[mcp] tool run failed; answering without tools");
		return null;
	} finally {
		await conn.close();
	}
}
