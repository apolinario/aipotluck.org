// Cross-encoder reranking of open-search candidates by true query-relevance,
// using an OPEN reranker (BGE) served on the SAME sovereign endpoint as the chat
// model (CSCS /v1/rerank, Cohere-compatible). This is the 2026-standard fix for
// the failure mode we hit: BM25/keyword retrieval returns off-topic pages ranked
// high; a cross-encoder scores (query, doc) jointly and reorders — and the off-
// topic ones score ~0, so a small threshold drops them. No closed vendor, no new
// infra: the reranker is already in the CSCS model catalog.
//
// Gated on the RERANK_MODEL env var (empty = off) so it's prod-safe and a no-op
// on hosts that don't serve a reranker (e.g. the HF-router rollback path). Always
// best-effort: any error returns the input order unchanged so search never breaks.

import { config } from "$lib/server/config";
import { logger } from "$lib/server/logger";

/** Configured reranker model id (e.g. "BAAI/bge-reranker-v2-m3"); "" = disabled. */
export function rerankModel(): string {
	return (config.RERANK_MODEL || "").trim();
}

type RerankResult = { index: number; relevance_score: number };

/**
 * Pure: turn the /v1/rerank response into a reordered subset of the original
 * candidates. Sorted by relevance (the API already sorts), dropping anything
 * below `minScore` and keeping at most `topK`. Indices that don't map to a real
 * candidate are skipped. Exported for unit testing without a network call.
 */
export function applyRerank<T>(
	candidates: T[],
	results: RerankResult[] | undefined,
	opts: { topK?: number; minScore?: number } = {}
): T[] {
	if (!results?.length) {
		return candidates;
	}
	const { topK = candidates.length, minScore = 0 } = opts;
	const ranked = [...results]
		.sort((a, b) => b.relevance_score - a.relevance_score)
		.filter((r) => r.relevance_score >= minScore && candidates[r.index] !== undefined)
		.slice(0, topK)
		.map((r) => candidates[r.index]);
	// Never return empty when we started with candidates: if the threshold nuked
	// everything, the query was a poor match but some grounding still beats none —
	// fall back to the single best-ranked candidate.
	if (ranked.length === 0) {
		const best = [...results].sort((a, b) => b.relevance_score - a.relevance_score)[0];
		return candidates[best.index] !== undefined ? [candidates[best.index]] : candidates;
	}
	return ranked;
}

/**
 * Reorder candidates by cross-encoder relevance to the query. Best-effort:
 * returns the input unchanged on disabled / error / single-candidate. Each
 * candidate is scored on its title + snippet.
 */
export async function rerankByRelevance<T extends { title: string; snippet: string }>(
	query: string,
	candidates: T[],
	opts: { topK?: number; minScore?: number; timeoutMs?: number } = {}
): Promise<T[]> {
	const model = rerankModel();
	if (!model || candidates.length <= 1) {
		return candidates;
	}
	const base = (config.OPENAI_BASE_URL || "").replace(/\/$/, "");
	const key = config.OPENAI_API_KEY || config.HF_TOKEN || "";
	const documents = candidates.map((c) => `${c.title}\n${c.snippet}`.slice(0, 1200));
	// Own timeout — NOT the caller's retrieval budget. Reranking runs after
	// Wikipedia+Marginalia, so sharing their (often nearly-spent) abort signal
	// starved the call and silently degraded it to retrieval order.
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 6000);
	try {
		const res = await fetch(`${base}/rerank`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
			body: JSON.stringify({ model, query, documents }),
			signal: ac.signal,
		});
		if (!res.ok) {
			logger.warn({ status: res.status }, "[rerank] non-OK; keeping retrieval order");
			return candidates;
		}
		const json = (await res.json()) as { results?: RerankResult[] };
		return applyRerank(candidates, json.results, opts);
	} catch (e) {
		logger.warn(e, "[rerank] failed; keeping retrieval order");
		return candidates;
	} finally {
		clearTimeout(timer);
	}
}
