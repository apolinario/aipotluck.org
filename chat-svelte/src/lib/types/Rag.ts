// Shared types for RAG-store grounding. The local Tier-A store and the EPFL
// federated store return citable snippets (numbered sources); the SyftHub vault
// returns a synthesized, privacy-filtered answer that is grounded separately
// (it is not a retrievable document, so it gets no citation number).

/** Which store a source came from — also the label shown in the evidence block. */
export type RagEngine = "Potluck" | "SyftHub:EPFL" | "SyftHub:Vault";

/** A single retrieved, citable snippet. */
export type RagSource = {
	n: number; // citation number, assigned at merge time
	title: string;
	url?: string;
	snippet: string;
	engine: RagEngine;
	score?: number; // similarity/relevance (0-1) where the store reports it
};

/** What the orchestrator hands the grounding injector for a turn. */
export type RagContext = {
	query: string;
	sources: RagSource[];
	evidence: string; // numbered evidence block built from `sources`
	asOf: string; // ISO timestamp the retrieval ran
	/** Synthesized answer from the federated vault, kept apart from numbered sources. */
	vaultSynthesis?: string;
};

/** Which stores the router selected for a turn. */
export type RagSourceSelection = {
	local: boolean;
	epfl: boolean;
	vault: boolean;
};
