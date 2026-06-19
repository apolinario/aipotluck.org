/**
 * Tool-serving probe: does the CSCS Apertus endpoint handle the tool-calling cases MCP
 * needs (vs just the single web_search we already use)? Bare prompts (no persona — the
 * persona suppresses tool-use by design), temperature 0.
 *
 *   A. multi-tool discrimination — advertise 2 tools, does it pick the right one + args?
 *   B. tool with NO parameters — the documented serving-layer "tools without parameters" edge case.
 *   C. discriminate among 3 (incl. the no-param one) on a search query.
 *
 * Run: npx vite-node evals/tool-serving-probe/run.ts   (needs .env.local CSCS creds)
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const HERE = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
	const f = join(HERE, "..", "..", ".env.local");
	if (!existsSync(f)) return;
	for (const line of readFileSync(f, "utf8").split("\n")) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
	}
}
loadEnv();

const MODEL = (process.env.MODEL_ALLOWLIST || "").split(",")[0].trim();
const BASE = process.env.OPENAI_BASE_URL || "";
const KEY = process.env.OPENAI_API_KEY || process.env.HF_TOKEN || "";
if (!MODEL || !BASE || !KEY) {
	console.error("Missing MODEL_ALLOWLIST / OPENAI_BASE_URL / OPENAI_API_KEY in .env.local");
	process.exit(1);
}
const client = new OpenAI({ apiKey: KEY, baseURL: BASE, defaultHeaders: { "User-Agent": "aipotluck-chat" } });

const T = {
	web_search: {
		type: "function" as const,
		function: {
			name: "web_search",
			description: "Search the open web for current or external facts.",
			parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
		},
	},
	get_weather: {
		type: "function" as const,
		function: {
			name: "get_weather",
			description: "Get the current weather for a city.",
			parameters: {
				type: "object",
				properties: { location: { type: "string" } },
				required: ["location"],
			},
		},
	},
	get_server_status: {
		type: "function" as const,
		function: {
			name: "get_server_status",
			description: "Return whether the service is currently up. Takes no arguments.",
			parameters: { type: "object", properties: {} }, // NO params — the documented bug
		},
	},
	// Workaround test: same tool but with a single dummy OPTIONAL param so `properties` is
	// non-empty (the bug is about empty properties).
	get_server_status_dummy_opt: {
		type: "function" as const,
		function: {
			name: "get_server_status",
			description: "Return whether the service is currently up.",
			parameters: {
				type: "object",
				properties: { _: { type: "string", description: "ignored; leave empty" } },
			},
		},
	},
	// And a dummy REQUIRED param, in case optional still serializes empty.
	get_server_status_dummy_req: {
		type: "function" as const,
		function: {
			name: "get_server_status",
			description: "Return whether the service is currently up.",
			parameters: {
				type: "object",
				properties: { noop: { type: "string", description: "pass any value, e.g. 'check'" } },
				required: ["noop"],
			},
		},
	},
};

async function probe(label: string, tools: unknown[], userMsg: string) {
	try {
		const res = await client.chat.completions.create({
			model: MODEL,
			messages: [{ role: "user", content: userMsg }],
			tools: tools as OpenAI.Chat.ChatCompletionTool[],
			tool_choice: "auto",
			max_tokens: 120,
			temperature: 0,
			stream: false,
		});
		const calls = res.choices?.[0]?.message?.tool_calls ?? [];
		const summary = calls.map((c) => `${c.function?.name}(${c.function?.arguments})`);
		console.log(`\n[${label}] "${userMsg}"`);
		console.log(`  tool_calls: ${summary.length ? summary.join(", ") : "(none)"}`);
		if (!calls.length) console.log(`  text: ${res.choices?.[0]?.message?.content?.slice(0, 160)}`);
	} catch (e) {
		console.log(`\n[${label}] ERROR: ${e instanceof Error ? e.message : e}`);
	}
}

async function main() {
	console.log(`model: ${MODEL}\nbase:  ${BASE}`);
	await probe("A multi-tool", [T.web_search, T.get_weather], "What's the weather in Geneva right now?");
	await probe("B no-params", [T.get_server_status], "Is the service up? Check its status.");
	await probe(
		"C discriminate-3",
		[T.web_search, T.get_weather, T.get_server_status],
		"Find the latest news on the EU AI Act."
	);
	await probe("D dummy-optional", [T.get_server_status_dummy_opt], "Is the service up? Check its status.");
	await probe("E dummy-required", [T.get_server_status_dummy_req], "Is the service up? Check its status.");
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});
