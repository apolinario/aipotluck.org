import { json, error, type RequestHandler } from "@sveltejs/kit";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import { openSearch } from "$lib/server/search/openSearch";

// Open-knowledge search endpoint: the client calls this when the user turns on
// web search (or accepts the "search open sources?" affordance). Returns
// numbered sources + an evidence block the chat turn is then grounded on.
// Open sources only (Wikipedia + Marginalia) — see $lib/server/search/openSearch.
export const GET: RequestHandler = async ({ locals, url }) => {
	requireAuth(locals);

	const q = url.searchParams.get("q")?.trim();
	if (!q) {
		throw error(400, "missing query");
	}
	if (q.length > 400) {
		throw error(400, "query too long");
	}

	try {
		const result = await openSearch(q, { timeoutMs: 9000 });
		return json(result, { headers: { "cache-control": "no-store" } });
	} catch {
		throw error(502, "search failed");
	}
};
