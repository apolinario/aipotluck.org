// Open-knowledge web search for the chat — genuinely-open sources only, called
// directly over HTTPS from the SvelteKit server route (no self-hosted service,
// no closed vendor). Three open engines, all keyless or open-key:
//   • Wikipedia — open public knowledge; queried in English AND, when the query
//     is in another language, that language's edition (multilingual reference).
//   • Marginalia — open independent crawler (general open-web reach, indie scale).
//   • OpenAlex — open scholarly index (academic/research, with real publication
//     dates + source language; no key, polite pool via mailto).
// A Google-scale open web index still does not exist — that stays an honest GAP
// on the map, not something we fake. Ported from the Next chat/ app.

import { distillQuery } from "./distill";
import { rerankByRelevance, rerankModel } from "./rerank";
import { reconstructAbstract, detectWikiLang } from "./searchUtil";
import { config } from "$lib/server/config";
import type { OpenSearchResult, SearchSource } from "$lib/types/Search";

export type { OpenSearchResult, SearchSource };

const UA = "AIPotluck/0.1 (open-knowledge search; contact@aipotluck.org)";

async function getJSON(
	url: string,
	signal?: AbortSignal,
	headers?: Record<string, string>
): Promise<unknown> {
	const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal });
	if (!res.ok) {
		throw new Error(`${url} → ${res.status}`);
	}
	return res.json();
}

// Wikipedia: top search hits WITH intro extracts in a single generator query.
// `lang` selects the language edition (default English); non-English sources are
// tagged so the citation can show a language chip.
async function searchWikipedia(
	query: string,
	limit: number,
	lang = "en",
	signal?: AbortSignal
): Promise<Omit<SearchSource, "n">[]> {
	const u = new URL(`https://${lang}.wikipedia.org/w/api.php`);
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
			url: p.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
			snippet: (p.extract ?? "").replace(/\s+/g, " ").trim().slice(0, 480),
			engine: "Wikipedia" as const,
			asOf: p.touched, // last-edited timestamp — the honest "as of" for the claim
			...(lang !== "en" ? { lang } : {}),
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

// Marginalia: open independent crawler, JSON API (api2 endpoint, API-Key header).
// Auth: MARGINALIA_API_KEY or the shared "public" demo key (rate-limited). When
// MARGINALIA_FILTER names a server-side custom filter (e.g. temporal-bias RECENT),
// it's applied to bias results by recency — the structural fix for stale-source drift,
// since Marginalia estimates publication dates internally but never returns them per-result.
async function searchMarginalia(
	query: string,
	limit: number,
	signal?: AbortSignal
): Promise<Omit<SearchSource, "n">[]> {
	const apiKey = config.MARGINALIA_API_KEY || "public";
	const filter = config.MARGINALIA_FILTER;
	const u = new URL("https://api2.marginalia-search.com/search");
	u.searchParams.set("query", query);
	u.searchParams.set("count", String(limit));
	if (filter) u.searchParams.set("filter", filter);
	const data = (await getJSON(u.toString(), signal, { "API-Key": apiKey })) as {
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

// OpenAlex: open scholarly index (works metadata). Keyless — the free "polite
// pool" only asks for a mailto. Each work carries a real publication_date and a
// language, so academic sources get honest dates (which Marginalia can't give).
interface OpenAlexWork {
	id: string;
	title?: string;
	doi?: string | null;
	publication_date?: string;
	language?: string;
	abstract_inverted_index?: Record<string, number[]> | null;
	primary_location?: {
		landing_page_url?: string | null;
		source?: { display_name?: string } | null;
	};
	open_access?: { oa_url?: string | null };
}
async function searchOpenAlex(
	query: string,
	limit: number,
	signal?: AbortSignal
): Promise<Omit<SearchSource, "n">[]> {
	const u = new URL("https://api.openalex.org/works");
	u.searchParams.set("search", query);
	u.searchParams.set("per-page", String(limit));
	u.searchParams.set("mailto", "contact@aipotluck.org"); // polite pool (no key needed)
	const data = (await getJSON(u.toString(), signal)) as { results?: OpenAlexWork[] };
	return (data.results ?? [])
		.filter((w) => w.title?.trim())
		.map((w) => {
			const venue = w.primary_location?.source?.display_name;
			const abstract = reconstructAbstract(w.abstract_inverted_index);
			const snippet = (
				abstract || [venue, w.publication_date?.slice(0, 4)].filter(Boolean).join(" · ")
			)
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 360);
			const url = w.doi || w.primary_location?.landing_page_url || w.open_access?.oa_url || w.id;
			return {
				title: (w.title ?? "").trim(),
				url,
				snippet,
				engine: "OpenAlex" as const,
				...(w.publication_date ? { asOf: w.publication_date } : {}),
				...(w.language && w.language !== "en" ? { lang: w.language } : {}),
			};
		})
		.filter((s) => s.url && s.snippet);
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
	opts: {
		wikipedia?: number;
		marginalia?: number;
		openalex?: number;
		keep?: number;
		timeoutMs?: number;
	} = {}
): Promise<OpenSearchResult> {
	// With a reranker configured, cast a WIDER net and let the cross-encoder pick
	// the best — recall from the wide retrieval, precision from the rerank. Without
	// one, keep the original tight limits (no extra latency, unchanged behavior).
	const reranking = !!rerankModel();
	const {
		wikipedia = reranking ? 6 : 3,
		marginalia = reranking ? 10 : 4,
		openalex = reranking ? 6 : 3,
		keep = 6,
		timeoutMs = 8000,
	} = opts;
	// Focus the query before it hits the engines: a conversational turn ranks
	// worse than its core entities. The distilled string is what we report back
	// as `query`, so the user sees exactly what the open web was searched for.
	const searchQuery = distillQuery(query);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const asOf = new Date().toISOString();
	try {
		// All engines run in parallel; any one failing degrades rather than breaks.
		// English Wikipedia always; a non-English edition too when the query looks
		// non-English (multilingual reference); plus Marginalia (open web) + OpenAlex
		// (scholarly). Wall-clock = the slowest engine, not the sum.
		const wikiLang = detectWikiLang(searchQuery);
		const engines: Promise<Omit<SearchSource, "n">[]>[] = [
			searchWikipedia(searchQuery, wikipedia, "en", controller.signal),
			searchMarginalia(searchQuery, marginalia, controller.signal),
			searchOpenAlex(searchQuery, openalex, controller.signal),
		];
		if (wikiLang)
			engines.push(searchWikipedia(searchQuery, wikipedia, wikiLang, controller.signal));
		const settled = await Promise.allSettled(engines);

		let merged = dedupe(settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []))).filter(
			(s) => s.snippet
		);

		// Cross-encoder rerank by true query-relevance, keeping the best `keep` and
		// dropping clearly off-topic hits (the failure mode that returned generic AI
		// pages for an "EU AI Act" query). Best-effort: a no-op when disabled or on
		// any reranker error, so retrieval order survives. Without a reranker, still
		// cap to `keep` so more engines don't bloat the grounding context.
		if (reranking) {
			merged = await rerankByRelevance(searchQuery, merged, { topK: keep, minScore: 0.01 });
		} else {
			merged = merged.slice(0, keep);
		}

		const sources: SearchSource[] = merged.map((s, i) => ({ ...s, n: i + 1 }));
		const evidence = sources
			.map((s) => {
				const tag = `${s.engine}${s.lang ? ` ${s.lang.toUpperCase()}` : ""}${s.asOf ? `, ${s.asOf.slice(0, 10)}` : ""}`;
				return `[${s.n}] ${s.title} (${tag})\n${s.snippet}\n${s.url}`;
			})
			.join("\n\n");
		return { query: searchQuery, sources, evidence, asOf };
	} finally {
		clearTimeout(timer);
	}
}
