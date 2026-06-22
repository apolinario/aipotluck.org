// Shared (client + server) types for open-knowledge web search. The engine
// implementation lives in $lib/server/search/openSearch.ts (server-only); these
// types are kept here so client components (the citations strip) and the message
// schema can reference them without importing server code.

// Single source of truth for the open search engines. The TS union below AND the runtime Zod
// validation in routes/conversation/[id]/+server.ts both derive from this — so adding an engine
// in openSearch.ts can't silently drift the conversation endpoint's schema (which previously
// rejected "OpenAlex" with a 500, killing any grounded turn whose sources included it).
export const SEARCH_ENGINES = ["Wikipedia", "Marginalia", "OpenAlex"] as const;
export type SearchEngine = (typeof SEARCH_ENGINES)[number];

export type SearchSource = {
	n: number; // citation number
	title: string;
	url: string;
	snippet: string;
	engine: SearchEngine;
	asOf?: string; // ISO date for time-sensitive sources (Wikipedia last-edit, OpenAlex publication)
	lang?: string; // BCP-47-ish source language for non-English sources (e.g. "fr")
	imageUrl?: string; // optional thumbnail (Wikimedia-hosted) shown in the citation strip; UI-only
};

export type OpenSearchResult = {
	query: string;
	sources: SearchSource[];
	evidence: string; // numbered evidence block to inject into the model turn
	asOf: string; // ISO date the search ran
};

// What the client attaches to a turn when web search is on, and what gets
// persisted on the assistant message so the citations + map highlight survive
// reload. `evidence` is server-only grounding input and is NOT persisted.
export type SearchContext = {
	query: string;
	sources: SearchSource[];
	asOf: string;
	evidence: string;
};
