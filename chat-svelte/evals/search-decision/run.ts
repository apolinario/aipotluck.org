/**
 * Search-decision eval: does the chat decide to run an open-web search when a query
 * needs current/external info, and skip it otherwise? Written in TS so it imports the
 * real chat logic (heuristic, persona, tool schema) rather than a copy that could drift.
 * See FINDINGS.md for results and the recommendation.
 *
 * Conditions:
 *   heuristic    — isRecencyQuery() only (no model call). The production regex layer.
 *   bare_tool    — model + WEB_SEARCH_TOOL, tool_choice auto, on a bare prompt (the
 *                  decideSearchViaTool decision path).
 *   persona_tool — the same tool call under the full chat persona system prompt.
 *
 * Recall = of the queries that need search, how many searched (catches misses).
 * Specificity = of the queries that don't, how many were correctly skipped (catches
 * over-searching). A "search everything" policy scores 100% recall and 0% specificity;
 * both should be high.
 *
 * Run:  npx vite-node evals/search-decision/run.ts            (cached)
 *       npx vite-node evals/search-decision/run.ts --no-cache (re-call CSCS)
 * Needs OPENAI_API_KEY + OPENAI_BASE_URL + MODEL_ALLOWLIST in .env.local (CSCS).
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { isRecencyQuery } from "$lib/search/recency";
import { buildPersonaPrompt } from "$lib/server/textGeneration/persona";
import { WEB_SEARCH_TOOL } from "$lib/server/search/toolSearch";

// The tool-use directive appended to the system prompt in the persona_tool condition,
// so that condition reflects a realistic "persona + advertise the tool" prompt.
const TOOL_USE_DIRECTIVE =
	"You can call the web_search tool. Call it whenever answering well needs current, post-training, or external facts — recent events, live data, or anything phrased as latest/current/now/today. For timeless questions (definitions, how-things-work, math, code, reasoning) answer directly without searching.";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, ".cache");
const noCache = process.argv.includes("--no-cache");
// --cases <file>: which labeled set to score (default cases.jsonl; held-out via flag).
// --conditions a,b,c: subset the compute conditions (skip the ones not needed for a run,
// e.g. on held-out we only need heuristic/heur_*/bare_tool — saves CSCS calls).
function argVal(flag: string): string | undefined {
	const i = process.argv.indexOf(flag);
	return i >= 0 ? process.argv[i + 1] : undefined;
}
const CASES_FILE = argVal("--cases") || "cases.jsonl";
const CONDITIONS_SUBSET = argVal("--conditions")?.split(",").map((s) => s.trim());

// Minimal .env.local loader — vite-node doesn't inject non-VITE_ env into process.env.
function loadEnv() {
	const f = join(HERE, "..", "..", ".env.local");
	if (!existsSync(f)) return;
	for (const line of readFileSync(f, "utf8").split("\n")) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (!m) continue;
		const val = m[2].replace(/^["']|["']$/g, "");
		if (!process.env[m[1]]) process.env[m[1]] = val;
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

const openai = new OpenAI({
	apiKey: KEY,
	baseURL: BASE,
	defaultHeaders: { "User-Agent": "aipotluck-chat" },
});

type Case = { id: string; query: string; needs_search: boolean; bucket: string };
const cases: Case[] = readFileSync(join(HERE, CASES_FILE), "utf8")
	.split("\n")
	.filter((l) => l.trim())
	.map((l) => JSON.parse(l));

type Condition =
	| "heuristic"
	| "bare_tool"
	| "persona_tool"
	| "abl_no_recency"
	| "abl_no_recency_style"
	| "abl_minimal"
	| "heur_denoise"
	| "heur_denoise_plus";
// Conditions computed directly (regex or one model call). Union conditions (below) are
// DERIVED from these without extra calls.
const CONDITIONS: Condition[] = [
	"heuristic",
	"bare_tool",
	"persona_tool",
	// Ablations: which persona paragraph(s) suppress tool-calling? Built by stripping
	// paragraphs from the real persona output (prod persona.ts is left untouched).
	"abl_no_recency", // drop the "Recency:" paragraph (instructs the model to hedge on latest/now)
	"abl_no_recency_style", // also drop "Style:" (lead-with-the-direct-answer)
	"abl_minimal", // intro paragraph only — does sheer prompt bulk dilute the tool affordance?
	"heur_denoise", // heuristic + exclude coding/technical contexts (kills the spicy false-positives)
	"heur_denoise_plus", // also catch a few unworded volatile-entity patterns (CEO/PM/population/rate of)
];

// Union conditions — the candidate production configs. shouldRunSearch already uses the
// heuristic as a free fast-path and defers to the model only when it abstains, so the
// DECISION outcome equals (heuristic OR bare-model). Derived by OR-ing per-case results,
// no extra model calls. Names are display-only (not in the compute list).
const UNIONS: { name: string; of: [Condition, Condition] }[] = [
	{ name: "denoise∪bare", of: ["heur_denoise", "bare_tool"] },
	{ name: "denoise+∪bare", of: ["heur_denoise_plus", "bare_tool"] },
];

// Apply --conditions subset (default: all). Unions survive only if both inputs are active.
const ACTIVE_CONDITIONS: Condition[] = CONDITIONS_SUBSET
	? CONDITIONS.filter((c) => CONDITIONS_SUBSET.includes(c))
	: CONDITIONS;
const ACTIVE_UNIONS = UNIONS.filter((u) => u.of.every((c) => ACTIVE_CONDITIONS.includes(c)));

// De-noised heuristic: the real recency regex, but suppressed when the query is clearly a
// coding/technical how-to (where "current/status/latest" are false triggers). Defined here
// for measurement; if it wins, port the negative filter into prod recency.ts.
const TECHNICAL_RE =
	/\b(python|javascript|typescript|java|c\+\+|c#|rust|go(?:lang)?|ruby|php|swift|kotlin|bash|shell|zsh|powershell|sql|git|github|docker|kubernetes|k8s|systemd|linux|unix|npm|node|deno|regex|css|html|json|yaml|api|sdk|cli|terminal|compiler|runtime|function|variable|array|string|integer|command|circuit|resistor|voltage|ohm|capacitor|current flowing|timestamp|working directory)\b/i;
// Volatile-entity role patterns the recency regex misses (no trigger word but the fact
// changes). Conservative — offices/metrics that reliably move, not broad "who won X".
const ENTITY_ROLE_RE =
	/\b(who\s+is\s+(?:the\s+)?(?:current\s+)?(?:ceo|president|prime\s+minister|chancellor|secretary[-\s]?general|leader|head|director|chair|governor|mayor|monarch|king|queen|pope)\s+of|population\s+of|gdp\s+of|(?:unemployment|inflation|interest|exchange)\s+rate)\b/i;
function heuristicDenoise(q: string): boolean {
	return isRecencyQuery(q) && !TECHNICAL_RE.test(q);
}
function heuristicDenoisePlus(q: string): boolean {
	return heuristicDenoise(q) || ENTITY_ROLE_RE.test(q);
}

// Persona built by stripping paragraphs (split on blank lines) whose first line starts
// with any given label. introOnly keeps just the first paragraph.
function stripParas(full: string, prefixes: string[]): string {
	return full
		.split("\n\n")
		.filter((p) => !prefixes.some((pre) => p.startsWith(pre)))
		.join("\n\n");
}

function systemFor(cond: Condition): string {
	const base = buildPersonaPrompt(MODEL);
	let persona = base;
	if (cond === "abl_no_recency") persona = stripParas(base, ["Recency:"]);
	else if (cond === "abl_no_recency_style") persona = stripParas(base, ["Recency:", "Style:"]);
	else if (cond === "abl_minimal") persona = base.split("\n\n")[0];
	return `${persona}\n\n${TOOL_USE_DIRECTIVE}`;
}

function messagesFor(cond: Condition, query: string): OpenAI.Chat.ChatCompletionMessageParam[] {
	if (cond === "bare_tool") return [{ role: "user", content: query }];
	return [
		{ role: "system", content: systemFor(cond) },
		{ role: "user", content: query },
	];
}

async function decideViaModel(cond: Condition, query: string): Promise<boolean> {
	const key = createHash("sha256").update(`${cond}|${MODEL}|${query}`).digest("hex").slice(0, 16);
	const cacheFile = join(CACHE, `${key}.json`);
	if (!noCache && existsSync(cacheFile)) {
		return JSON.parse(readFileSync(cacheFile, "utf8")).searched;
	}
	const res = await openai.chat.completions.create({
		model: MODEL,
		messages: messagesFor(cond, query),
		tools: [WEB_SEARCH_TOOL as unknown as OpenAI.Chat.ChatCompletionTool],
		tool_choice: "auto",
		stream: false,
		max_tokens: 80,
		temperature: 0,
	});
	const calls = res.choices?.[0]?.message?.tool_calls ?? [];
	const searched = calls.some((c) => c.type === "function" && c.function?.name === "web_search");
	if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
	writeFileSync(cacheFile, JSON.stringify({ searched, query, cond }, null, 2));
	return searched;
}

async function decide(cond: Condition, c: Case): Promise<boolean> {
	if (cond === "heuristic") return isRecencyQuery(c.query);
	if (cond === "heur_denoise") return heuristicDenoise(c.query);
	if (cond === "heur_denoise_plus") return heuristicDenoisePlus(c.query);
	return decideViaModel(cond, c.query);
}

function pct(n: number, d: number): string {
	return d === 0 ? "  -  " : `${((100 * n) / d).toFixed(0).padStart(3)}%`;
}

async function main() {
	console.log(`model: ${MODEL}\nbase:  ${BASE}\ncases: ${cases.length}  (cache: ${!noCache})\n`);

	// condition -> case.id -> searched
	const results: Record<string, Record<string, boolean>> = {};
	for (const cond of ACTIVE_CONDITIONS) {
		results[cond] = {};
		for (const c of cases) results[cond][c.id] = await decide(cond, c);
		process.stdout.write(`✓ ${cond}\n`);
	}
	// Derive the union (candidate prod) configs from the base results — no extra calls.
	for (const u of ACTIVE_UNIONS) {
		results[u.name] = {};
		for (const c of cases) results[u.name][c.id] = results[u.of[0]][c.id] || results[u.of[1]][c.id];
	}
	const DISPLAY: string[] = [...ACTIVE_CONDITIONS, ...ACTIVE_UNIONS.map((u) => u.name)];

	const needs = cases.filter((c) => c.needs_search);
	const skips = cases.filter((c) => !c.needs_search);

	console.log("\n=== overall ===");
	console.log("condition           recall(need→search)  specificity(skip→skip)  accuracy");
	for (const cond of DISPLAY) {
		const r = needs.filter((c) => results[cond][c.id]).length;
		const s = skips.filter((c) => !results[cond][c.id]).length;
		const acc = r + s;
		console.log(
			`${cond.padEnd(18)}  ${pct(r, needs.length)} (${r}/${needs.length})        ` +
				`${pct(s, skips.length)} (${s}/${skips.length})         ${pct(acc, cases.length)}`
		);
	}

	const buckets = [...new Set(cases.map((c) => c.bucket))];
	console.log("\n=== per-bucket search-rate (want: high for recency_*, low for timeless*) ===");
	console.log(`bucket               n   ${DISPLAY.map((c) => c.padEnd(15)).join("")}`);
	for (const b of buckets) {
		const rows = cases.filter((c) => c.bucket === b);
		const rates = DISPLAY.map((cond) => {
			const hit = rows.filter((c) => results[cond][c.id]).length;
			return `${pct(hit, rows.length)} ${hit}/${rows.length}`.padEnd(15);
		});
		console.log(`${b.padEnd(20)} ${String(rows.length).padStart(2)}   ${rates.join("")}`);
	}

	console.log("\n=== residual disagreements for the candidate union configs ===");
	for (const cond of UNIONS.map((u) => u.name)) {
		const wrong = cases.filter((c) => results[cond][c.id] !== c.needs_search);
		console.log(`\n${cond}: ${wrong.length} wrong`);
		for (const c of wrong) {
			const got = results[cond][c.id] ? "searched" : "skipped";
			const want = c.needs_search ? "should search" : "should skip";
			console.log(`  [${c.id} ${c.bucket}] ${got} but ${want} — "${c.query}"`);
		}
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
