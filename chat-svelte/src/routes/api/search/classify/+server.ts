import { json, error, type RequestHandler } from "@sveltejs/kit";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import {
	classifySearchNeed,
	decideSearchViaTool,
	decideSearchViaMargin,
} from "$lib/server/search/searchDecision";
import { config } from "$lib/server/config";
import { resolveTriggerStrategy } from "$lib/search/triggerStrategy";
import { TOOL_CALLING_WIRED } from "$lib/server/search/toolSearch";

// Model-driven search decision: the client calls this when the trigger strategy
// enables the model (see $lib/search/triggerStrategy). Returns { shouldSearch,
// query? } — the client then runs /api/search just like a heuristic hit, using
// the model's authored `query` when present. Two mechanisms by active strategy:
//   "tool" (+ TOOL_CALLING_WIRED): real OpenAI tool-calling — the model decides
//          AND authors the search query (decideSearchViaTool).
//   "model" (or "tool" before wiring): the cheap yes/no classifier (no query).
// Both are best-effort and fail closed to { shouldSearch: false }.
export const GET: RequestHandler = async ({ locals, url }) => {
	requireAuth(locals);

	const q = url.searchParams.get("q")?.trim();
	if (!q) {
		throw error(400, "missing query");
	}
	if (q.length > 400) {
		throw error(400, "query too long");
	}

	// Reflect.get: PUBLIC_SEARCH_TRIGGER isn't in committed .env, so direct config.X
	// access fails svelte-check wherever it's unset (CI). See rerank.ts.
	const strategy = resolveTriggerStrategy(
		Reflect.get(config, "PUBLIC_SEARCH_TRIGGER") as string | undefined
	);
	if (strategy === "tool" && TOOL_CALLING_WIRED) {
		const decision = await decideSearchViaTool(q, locals);
		return json(decision, { headers: { "cache-control": "no-store" } });
	}

	// "margin" — logprob-margin gate (the proven path for the tool-calling-weak 70B). Returns
	// `ok` so the client knows whether to trust the verdict or fall back to the recency heuristic.
	if (strategy === "margin") {
		const { shouldSearch, ok } = await decideSearchViaMargin(q, locals);
		return json({ shouldSearch, ok }, { headers: { "cache-control": "no-store" } });
	}

	const shouldSearch = await classifySearchNeed(q, locals);
	return json({ shouldSearch }, { headers: { "cache-control": "no-store" } });
};
