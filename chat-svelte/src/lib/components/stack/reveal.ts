// Decides which live-stack nodes a FINISHED turn lights, in real pipeline order.
//
// Honest by construction — this is a provenance invariant, not cosmetics:
//   - a moderation-declined turn never reached the model, so it lights ONLY the
//     open safety classifier (toxic-bert), never Apertus;
//   - retrieval nodes (web search, RAG stores) appear only when that layer ran;
//   - the compute cell (CSCS) lights only when the answer TRULY ran on sovereign
//     hardware — i.e. served directly on CSCS, not via the HF prototype host;
//   - otherwise the model node alone.

import type { RagEngine, RagSource } from "$lib/types/Rag";

// SINGLE SOURCE OF TRUTH for live-stack node ids. Every surface that lights/flashes/
// pulses a map node imports these — never a bare "apertus"/"websearch" literal — so a
// rename in static/data/stack-map.json can't silently leave a dispatcher pointing at a
// dead node (reveal.spec.ts asserts each id exists in the map).
export const MODEL_NODES = ["apertus"] as const;

export const COMPUTE_NODE = "cscs";

export const WEBSEARCH_NODE = "websearch";
export const CATALOG_RAG_NODE = "potluck-rag";
export const EPFL_RAG_NODE = "syft-epfl";
export const VAULT_NODE = "localculture";
export const ROUTER_NODE = "router";
export const SAFETY_NODES = ["toxicbert"] as const;

export const ALL_STACK_NODE_IDS = [
	...MODEL_NODES,
	COMPUTE_NODE,
	WEBSEARCH_NODE,
	CATALOG_RAG_NODE,
	EPFL_RAG_NODE,
	VAULT_NODE,
	ROUTER_NODE,
	...SAFETY_NODES,
] as const;

type RagLike = {
	sources?: RagSource[];
	vaultSynthesis?: string;
} | null | undefined;

/** Map node ids for the RAG engines present in a turn (pipeline order). */
export function ragRetrievalNodes(rag: RagLike): string[] {
	const nodes: string[] = [];
	const sources = rag?.sources ?? [];
	if (sources.some((s) => s.engine === "Potluck")) nodes.push(CATALOG_RAG_NODE);
	if (sources.some((s) => s.engine === "SyftHub:EPFL")) nodes.push(EPFL_RAG_NODE);
	if (rag?.vaultSynthesis?.trim()) nodes.push(VAULT_NODE);
	return nodes;
}

/** Stack node id to flash for a RAG engine label. */
export function ragNodeForEngine(engine: RagEngine): string | undefined {
	if (engine === "Potluck") return CATALOG_RAG_NODE;
	if (engine === "SyftHub:EPFL") return EPFL_RAG_NODE;
	return undefined;
}

export function computeRevealStages(
	answer: {
		moderation?: { flagged?: boolean } | null;
		webSearch?: { sources?: unknown[] } | null;
		rag?: RagLike;
	},
	opts?: { servedOnSovereignCompute?: boolean }
): string[] {
	if (answer.moderation?.flagged) return [...SAFETY_NODES];
	const stages: string[] = [];
	if (answer.webSearch?.sources?.length) stages.push(WEBSEARCH_NODE);
	stages.push(...ragRetrievalNodes(answer.rag));
	stages.push(...MODEL_NODES);
	return opts?.servedOnSovereignCompute ? [...stages, COMPUTE_NODE] : stages;
}

export function computePulseNodes(opts: {
	webGrounded?: boolean;
	rag?: RagLike;
	servedOnSovereignCompute?: boolean;
}): string[] {
	const nodes: string[] = [...MODEL_NODES];
	if (opts.webGrounded) nodes.push(WEBSEARCH_NODE);
	nodes.push(...ragRetrievalNodes(opts.rag));
	if (opts.servedOnSovereignCompute) nodes.push(COMPUTE_NODE);
	return nodes;
}
