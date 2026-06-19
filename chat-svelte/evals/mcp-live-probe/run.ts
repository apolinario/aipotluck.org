/**
 * Live probe: does the SDK + our (env-free) schema conversion work against a real Gradio Space
 * MCP endpoint? Mirrors src/lib/server/mcp/client.ts but without the $lib/server/logger ($env)
 * import, so it runs standalone under tsx. Connects, lists tools, calls one.
 *
 * Run: npx tsx evals/mcp-live-probe/run.ts [url] [toolName] [argsJson]
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mcpToolToOpenAITool, stripDummyArgs, type McpTool } from "../../src/lib/server/mcp/schema";

const MCP_URL = process.argv[2] || "https://abidlabs-mcp-tools.hf.space/gradio_api/mcp/";
const TOOL = process.argv[3];
const ARGS = process.argv[4] ? JSON.parse(process.argv[4]) : {};
// /sse → legacy SSE transport; anything else → modern Streamable HTTP.
const transport = MCP_URL.endsWith("/sse")
	? new SSEClientTransport(new URL(MCP_URL))
	: new StreamableHTTPClientTransport(new URL(MCP_URL));

async function main() {
	console.log("connecting:", MCP_URL, `(${MCP_URL.endsWith("/sse") ? "SSE" : "StreamableHTTP"})`);
	const client = new Client({ name: "aipotluck-chat", version: "0.1.0" }, { capabilities: {} });
	await client.connect(transport);

	const { tools } = await client.listTools();
	const mcpTools = (tools ?? []) as McpTool[];
	console.log(`\ntools (${mcpTools.length}):`);
	for (const t of mcpTools) {
		console.log(`  - ${t.name}: ${(t.description ?? "").slice(0, 90)}`);
		console.log(`      props: ${JSON.stringify(t.inputSchema?.properties ?? {})}`);
	}
	console.log(`\nfirst as OpenAI schema:\n${JSON.stringify(mcpToolToOpenAITool(mcpTools[0]), null, 2)}`);

	const toolName = TOOL || mcpTools[0]?.name;
	if (toolName) {
		console.log(`\ncalling ${toolName}(${JSON.stringify(ARGS)})…`);
		const res = await client.callTool({ name: toolName, arguments: stripDummyArgs(ARGS) });
		const blocks = (res.content ?? []) as Array<{ type: string; text?: string }>;
		const out = blocks
			.filter((b) => b.type === "text")
			.map((b) => b.text)
			.join("\n");
		console.log(`result: ${out.slice(0, 400)}`);
	}
	await client.close();
	console.log("\n✓ closed");
}
main().catch((e) => {
	console.error("ERR:", e instanceof Error ? e.message : e);
	process.exit(1);
});
