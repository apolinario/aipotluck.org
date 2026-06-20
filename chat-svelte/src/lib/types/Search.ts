// Shared (client + server) types for open-knowledge web search. The engine
// implementation lives in $lib/server/search/openSearch.ts (server-only); these
// types are kept here so client components (the citations strip) and the message
// schema can reference them without importing server code.

export type SearchSource = {
	n: number; // citation number
	title: string;
	url: string;
	snippet: string;
	engine: "Wikipedia" | "Marginalia" | "OpenAlex";
	asOf?: string; // ISO date for time-sensitive sources (Wikipedia last-edit, OpenAlex publication)
	lang?: string; // BCP-47-ish source language for non-English sources (e.g. "fr")
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
