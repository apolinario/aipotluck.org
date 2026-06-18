import { json, error, type RequestHandler } from "@sveltejs/kit";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import { classifySearchNeed } from "$lib/server/search/searchDecision";

// Model-driven search decision: the client calls this when the recency heuristic
// abstained and the trigger strategy enables the model classifier (see
// $lib/search/triggerStrategy). Returns { shouldSearch } — the client then runs
// /api/search exactly as it would for a heuristic hit. Best-effort: the
// classifier itself never throws (it fails closed to false).
export const GET: RequestHandler = async ({ locals, url }) => {
	requireAuth(locals);

	const q = url.searchParams.get("q")?.trim();
	if (!q) {
		throw error(400, "missing query");
	}
	if (q.length > 400) {
		throw error(400, "query too long");
	}

	const shouldSearch = await classifySearchNeed(q, locals);
	return json({ shouldSearch }, { headers: { "cache-control": "no-store" } });
};
