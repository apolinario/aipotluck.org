// Open-knowledge web search for the chat — genuinely-open sources only, called
// directly over HTTPS from the SvelteKit server route (no self-hosted service,
// no closed vendor). Wikipedia (open public knowledge, no key) carries
// explainers and current policy; Marginalia (open independent crawler, public
// key) adds general-web reach at indie scale. A Google-scale open web index does
// not exist — that stays an honest GAP on the map, not something we fake.
// Ported from the Next chat/ app (lib/search/open-search.ts).

import { distillQuery } from "./distill";
import type { OpenSearchResult, SearchSource } from "$lib/types/Search";

export type { OpenSearchResult, SearchSource };

const UA = "AIPotluck/0.1 (open-knowledge search; contact@aipotluck.org)";

async function getJSON(url: string, signal?: AbortSignal): Promise<unknown> {
	const res = await fetch(url, { headers: { "User-Agent": UA }, signal });
	if (!res.ok) {
		throw new Error(`${url} → ${res.status}`);
	}
	return res.json();
}

// Wikipedia: top search hits WITH intro extracts in a single generator query.
async function searchWikipedia(
	query: string,
	limit: number,
	signal?: AbortSignal
): Promise<Omit<SearchSource, "n">[]> {
	const u = new URL("https://en.wikipedia.org/w/api.php");
	u.search = new URLSearchParams({
		action: "query",
		generator: "search",
		gsrsearch: query,
		gsrlimit: String(limit),
		prop: "extracts|info",
		exintro: "1",
		explaintext: "1",
		exchars: "500",
		inprop: "url",
		format: "json",
		origin: "*",
	}).toString();
	const data = (await getJSON(u.toString(), signal)) as {
		query?: {
			pages?: Record<
				string,
				{ title: string; extract?: string; fullurl?: string; touched?: string; index?: number }
			>;
		};
	};
	const pages = Object.values(data.query?.pages ?? {});
	pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
	return pages
		.filter((p) => p.extract?.trim())
		.map((p) => ({
			title: p.title,
			url: p.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
			snippet: (p.extract ?? "").replace(/\s+/g, " ").trim().slice(0, 480),
			engine: "Wikipedia" as const,
			asOf: p.touched, // last-edited timestamp — the honest "as of" for the claim
		}));
}

// Obvious conspiracy/junk domains to drop. Marginalia favors non-commercial
// content, which on some queries surfaces fringe sites (caught in grounded
// testing on a crops query). Not exhaustive — Marginalia results are also
// labeled "broader open web" so they're never treated as authoritative alone.
const FRINGE = [
	"bibliotecapleyades",
	"naturalnews",
	"infowars",
	"rumormillnews",
	"abovetopsecret",
	"godlikeproductions",
	"davidicke",
	"veteranstoday",
	"globalresearch.ca",
	"zerohedge",
];
function isFringe(url: string): boolean {
	const h = url.toLowerCase();
	return FRINGE.some((d) => h.includes(d));
}

// Marginalia: open independent crawler, public JSON API (key=public, rate-limited).
async function searchMarginalia(
	query: string,
	limit: number,
	signal?: AbortSignal
): Promise<Omit<SearchSource, "n">[]> {
	const url = `https://api.marginalia.nu/public/search/${encodeURIComponent(query)}?key=public&count=${limit}`;
	const data = (await getJSON(url, signal)) as {
		results?: { url: string; title: string; description?: string }[];
	};
	return (data.results ?? [])
		.filter((r) => r.url && !isFringe(r.url))
		.map((r) => ({
			title: r.title?.trim() || r.url,
			url: r.url,
			snippet: (r.description ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
			engine: "Marginalia" as const,
		}));
}

function dedupe(items: Omit<SearchSource, "n">[]): Omit<SearchSource, "n">[] {
	const seen = new Set<string>();
	const out: Omit<SearchSource, "n">[] = [];
	for (const it of items) {
		const key = it.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		out.push(it);
	}
	return out;
}

export async function openSearch(
	query: string,
	opts: { wikipedia?: number; marginalia?: number; timeoutMs?: number } = {}
): Promise<OpenSearchResult> {
	const { wikipedia = 3, marginalia = 4, timeoutMs = 8000 } = opts;
	// Focus the query before it hits the engines: a conversational turn ranks
	// worse than its core entities. The distilled string is what we report back
	// as `query`, so the user sees exactly what the open web was searched for.
	const searchQuery = distillQuery(query);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const asOf = new Date().toISOString();
	try {
		// Both run in parallel; either failing degrades rather than breaks.
		const [wiki, marg] = await Promise.allSettled([
			searchWikipedia(searchQuery, wikipedia, controller.signal),
			searchMarginalia(searchQuery, marginalia, controller.signal),
		]);
		const merged = dedupe([
			...(wiki.status === "fulfilled" ? wiki.value : []),
			...(marg.status === "fulfilled" ? marg.value : []),
		]).filter((s) => s.snippet);

		const sources: SearchSource[] = merged.map((s, i) => ({ ...s, n: i + 1 }));
		const evidence = sources
			.map(
				(s) =>
					`[${s.n}] ${s.title} (${s.engine}${s.asOf ? `, updated ${s.asOf.slice(0, 10)}` : ""})\n${s.snippet}\n${s.url}`
			)
			.join("\n\n");
		return { query: searchQuery, sources, evidence, asOf };
	} finally {
		clearTimeout(timer);
	}
}
