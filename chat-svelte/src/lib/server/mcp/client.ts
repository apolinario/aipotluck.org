// MCP client — connect to an MCP server (e.g. an HF Gradio Space's /gradio_api/mcp/sse),
// list its tools as OpenAI-shaped function schemas, and call them. Thin wrapper over the
// official @modelcontextprotocol/sdk. The tool DECISION is made elsewhere by a bare-prompt
// router (the persona suppresses in-context tool-choice by design — see
// docs/mcp-restoration-scope.md); this module is just the transport + invocation.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { logger } from "$lib/server/logger";
import { mcpToolToOpenAITool, stripDummyArgs, type McpTool } from "./schema";
import type OpenAI from "openai";

export type McpConnection = {
	/** Raw MCP tool defs from the server. */
	tools: McpTool[];
	/** Same tools as OpenAI function schemas (no-param tools dummy-padded). */
	openaiTools: OpenAI.Chat.ChatCompletionTool[];
	/** Invoke a tool by name; dummy pad is stripped, text content blocks are flattened. */
	call(name: string, args: Record<string, unknown>): Promise<string>;
	close(): Promise<void>;
};

/** Connect, handshake, and list tools. Caller owns close(). Throws on connect/list failure. */
export async function connectMcp(url: string): Promise<McpConnection> {
	const client = new Client(
		{ name: "aipotluck-chat", version: "0.1.0" },
		{ capabilities: {} }
	);
	const transport = new SSEClientTransport(new URL(url));
	await client.connect(transport);

	const listed = await client.listTools();
	const tools = (listed.tools ?? []) as McpTool[];

	return {
		tools,
		openaiTools: tools.map(mcpToolToOpenAITool),
		async call(name, args) {
			const res = await client.callTool({ name, arguments: stripDummyArgs(args) });
			const blocks = (res.content ?? []) as Array<{ type: string; text?: string }>;
			return blocks
				.filter((b) => b.type === "text" && typeof b.text === "string")
				.map((b) => b.text)
				.join("\n")
				.trim();
		},
		async close() {
			try {
				await client.close();
			} catch (e) {
				logger.warn(e, "[mcp] close failed");
			}
		},
	};
}
