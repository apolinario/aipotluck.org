// Local Tier-A vector store: in-memory cosine search over the committed,
// pre-embedded catalog index (scripts/build-rag-index.mjs). Tier A is small
// (~60 chunks of gap-map categories, exemplar repos, the stack-map narrative,
// and the project-context blurb), so a brute-force cosine scan is plenty — no
// pgvector/sqlite needed.
//
// FAIL-OPEN: an empty/missing index, a dimension mismatch, or a failed query
// embedding all return [] so the chat answers normally without local grounding.

import ragIndex from "./data/rag-index.json";
import type { RagSource } from "$lib/types/Rag";
import { cosine, embedText } from "./embed";
import { localMinScore, localTopK } from "./env";

type IndexChunk = {
	id: string;
	source: string;
	title: string;
	url?: string;
	text: string;
	vector: number[];
};

type RagIndex = {
	model: string;
	dim: number;
	builtAt: string;
	chunks: IndexChunk[];
};

const index = ragIndex as RagIndex;

/** Trim a chunk to a sentence-ish snippet so the evidence block stays compact. */
function toSnippet(text: string, max = 480): string {
	const clean = text.replace(/\s+/g, " ").trim();
	return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

/**
 * Retrieve the top catalog chunks for a query as citable sources (without
 * citation numbers — the orchestrator assigns those when merging stores).
 */
export async function queryLocalStore(query: string): Promise<Omit<RagSource, "n">[]> {
	if (!index.chunks?.length) {
		return [];
	}
	const qv = await embedText(query);
	if (!qv || qv.length !== index.dim) {
		return [];
	}
	const minScore = localMinScore();
	const scored = index.chunks
		.map((c) => ({ chunk: c, score: cosine(qv, c.vector) }))
		.filter((s) => s.score >= minScore)
		.sort((a, b) => b.score - a.score)
		.slice(0, localTopK());

	return scored.map(({ chunk, score }) => ({
		title: chunk.title,
		url: chunk.url,
		snippet: toSnippet(chunk.text),
		engine: "Potluck" as const,
		score,
	}));
}

/** Whether the committed index actually has content (gates the local store). */
export function localStoreReady(): boolean {
	return (index.chunks?.length ?? 0) > 0;
}
