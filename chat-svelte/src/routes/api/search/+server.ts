import { json, error, type RequestHandler } from "@sveltejs/kit";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import { openSearch } from "$lib/server/search/openSearch";
import { contextualizeQuery, type RewriteTurn } from "$lib/server/search/queryRewrite";

// Open-knowledge search endpoint: the client calls this when the user turns on
// web search (or accepts the "search open sources?" affordance). Returns
// numbered sources + an evidence block the chat turn is then grounded on.
// Open sources only (Wikipedia + Marginalia + OpenAlex) — see $lib/server/search/openSearch.
async function runSearch(q: string) {
	if (q.length > 400) {
		throw error(400, "query too long");
	}
	try {
		const result = await openSearch(q, { timeoutMs: 9000 });
		return json(result, { headers: { "cache-control": "no-store" } });
	} catch {
		throw error(502, "search failed");
	}
}

// GET: a standalone query needing no conversation context (the common path).
export const GET: RequestHandler = async ({ locals, url }) => {
	requireAuth(locals);
	const q = url.searchParams.get("q")?.trim();
	if (!q) {
		throw error(400, "missing query");
	}
	return runSearch(q);
};

// POST: a follow-up query that may carry conversation history for coreference rewriting — e.g.
// "what most recent research says about it?" is rewritten to a standalone query BEFORE searching, so
// the open web returns on-topic sources instead of junk. History rides in the body (never the URL,
// per the no-PII-in-query-strings rule); the rewrite is best-effort and falls back to the raw query.
export const POST: RequestHandler = async ({ locals, request }) => {
	requireAuth(locals);
	const body = (await request.json().catch(() => ({}))) as {
		q?: unknown;
		history?: unknown;
	};
	const rawQ = typeof body.q === "string" ? body.q.trim() : "";
	if (!rawQ) {
		throw error(400, "missing query");
	}
	const history: RewriteTurn[] = Array.isArray(body.history)
		? body.history
				.filter(
					(m): m is RewriteTurn =>
						!!m &&
						typeof m === "object" &&
						(m.from === "user" || m.from === "assistant") &&
						typeof m.content === "string"
				)
				.slice(-4)
		: [];
	const q = history.length ? await contextualizeQuery(rawQ, history, locals) : rawQ;
	return runSearch(q);
};
