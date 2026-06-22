// Centralized reads for the RAG-store config keys. They are deploy-only and not
// in the committed .env, so we go through Reflect.get on the config proxy to
// avoid the ConfigProxy typecheck error on unset keys (same pattern as
// SPACE_MCP_URL / RERANK_MODEL). All federated paths are additive and gated:
// no token, no index, or any failure must fail open to a normal answer.

import { config } from "$lib/server/config";

function read(key: string): string {
	return ((Reflect.get(config, key) as string | undefined) || "").trim();
}

function readNumber(key: string, fallback: number): number {
	const n = Number(read(key));
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Master gate for all RAG grounding (local + federated). */
export function ragEnabled(): boolean {
	return read("RAG_ENABLED") === "true";
}

/** Embedding model id for the local Tier-A store (must match the built index). */
export function embeddingModel(): string {
	return read("RAG_EMBEDDING_MODEL") || "sentence-transformers/all-MiniLM-L6-v2";
}

/** HF Inference feature-extraction base (the HF router /v1 has no /embeddings). */
export function embeddingBaseUrl(): string {
	return (
		read("RAG_EMBEDDING_BASE_URL") || "https://router.huggingface.co/hf-inference/models"
	).replace(/\/$/, "");
}

/** Bearer token for the embedding endpoint — reuse the inference key. */
export function embeddingToken(): string {
	return read("OPENAI_API_KEY") || read("HF_TOKEN");
}

export function localTopK(): number {
	return readNumber("RAG_TOP_K", 5);
}

export function localMinScore(): number {
	const n = Number(read("RAG_MIN_SCORE"));
	return Number.isFinite(n) ? n : 0.35;
}

/** Whether to fall back to a model-driven source classifier when heuristics are ambiguous. */
export function classifierEnabled(): boolean {
	return read("RAG_CLASSIFIER_ENABLED") === "true";
}

/** SyftHub credentials/endpoints. Empty token disables the federated stores. */
export function syft() {
	return {
		token: read("SYFTHUB_API_TOKEN"),
		baseUrl: read("SYFTHUB_BASE_URL") || "https://syfthub.openmined.org",
		userEmail: read("SYFTHUB_USER_EMAIL"),
		epfl: {
			url: read("SYFTHUB_EPFL_ENDPOINT_URL"),
			slug: read("SYFTHUB_EPFL_SLUG"),
			owner: read("SYFTHUB_EPFL_OWNER"),
		},
		vaultModel: read("SYFTHUB_VAULT_MODEL"),
	};
}

/** Federated stores require a token; without one they are skipped entirely. */
export function syftEnabled(): boolean {
	return syft().token.length > 0;
}
