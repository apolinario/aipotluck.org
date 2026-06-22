// Single-string embedding via the HF Inference feature-extraction endpoint.
// The HF router (OPENAI_BASE_URL, /v1) does NOT expose /embeddings, so the local
// store embeds through {base}/{model}/pipeline/feature-extraction, which returns
// a flat number[] for one input. Best-effort: any failure returns null and the
// caller (the local RAG store) skips grounding rather than breaking the turn.
//
// The build script (scripts/build-rag-index.mjs) intentionally duplicates this
// tiny fetch — it runs in plain Node and cannot import this TS module — so keep
// the request shape in the two files in sync.

import { embeddingBaseUrl, embeddingModel, embeddingToken } from "./env";
import { logger } from "$lib/server/logger";

export async function embedText(text: string, timeoutMs = 6000): Promise<number[] | null> {
	const input = text.trim();
	if (!input) {
		return null;
	}
	const url = `${embeddingBaseUrl()}/${embeddingModel()}/pipeline/feature-extraction`;
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${embeddingToken()}`,
			},
			body: JSON.stringify({ inputs: input }),
			signal: ac.signal,
		});
		if (!res.ok) {
			logger.warn({ status: res.status }, "[rag] embedding endpoint non-OK; skipping local store");
			return null;
		}
		const json = (await res.json()) as unknown;
		// A single string yields number[]; some models nest it as number[][].
		if (Array.isArray(json) && typeof json[0] === "number") {
			return json as number[];
		}
		if (Array.isArray(json) && Array.isArray(json[0])) {
			return json[0] as number[];
		}
		logger.warn("[rag] unexpected embedding shape; skipping local store");
		return null;
	} catch (e) {
		logger.warn(e, "[rag] embedding failed; skipping local store");
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** Cosine similarity for two equal-length vectors. Returns 0 on degenerate input. */
export function cosine(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		return 0;
	}
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	if (na === 0 || nb === 0) {
		return 0;
	}
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
