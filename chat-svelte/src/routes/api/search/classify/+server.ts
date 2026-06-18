import { json, error, type RequestHandler } from "@sveltejs/kit";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import { classifySearchNeed, decideSearchViaTool } from "$lib/server/search/searchDecision";
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

	const strategy = resolveTriggerStrategy(config.PUBLIC_SEARCH_TRIGGER);
	if (strategy === "tool" && TOOL_CALLING_WIRED) {
		const decision = await decideSearchViaTool(q, locals);
		return json(decision, { headers: { "cache-control": "no-store" } });
	}

	const shouldSearch = await classifySearchNeed(q, locals);
	return json({ shouldSearch }, { headers: { "cache-control": "no-store" } });
};
