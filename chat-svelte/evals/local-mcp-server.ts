/**
 * Tiny local MCP server (Streamable HTTP) for the end-to-end proof — stands in for an open HF
 * Space so we can validate the whole chain (connectMcp -> router -> call -> grounded answer)
 * under our control, no hosted-Space flakiness. One `translate` tool (fake translation).
 *
 * Run: npx tsx evals/local-mcp-server.ts   →   http://localhost:8848/mcp
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";

const PORT = 8848;

function makeServer() {
	const server = new McpServer({ name: "local-translate", version: "0.0.1" });
	server.registerTool(
		"translate",
		{
			description:
				"Translate text into a target language. Use whenever the user asks to translate something.",
			inputSchema: {
				text: z.string().describe("the text to translate"),
				target: z.string().describe("the target language, e.g. 'French'"),
			},
		},
		async ({ text, target }) => ({
			content: [
				{
					type: "text" as const,
					text: `(${target}) ${text} — [translated by the local open MCP Space]`,
				},
			],
		})
	);
	return server;
}

const httpServer = createServer(async (req, res) => {
	if (req.method === "POST" && req.url?.startsWith("/mcp")) {
		const chunks: Buffer[] = [];
		for await (const c of req) chunks.push(c as Buffer);
		const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
		// Stateless: a fresh server+transport per request.
		const server = makeServer();
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
		res.on("close", () => {
			transport.close();
			server.close();
		});
		await server.connect(transport);
		await transport.handleRequest(req, res, body);
	} else {
		res.writeHead(405).end();
	}
});
httpServer.listen(PORT, () => console.log(`local MCP server: http://localhost:${PORT}/mcp`));
