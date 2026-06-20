// Decides which live-stack nodes a FINISHED turn lights, in real pipeline order.
//
// Honest by construction — this is a provenance invariant, not cosmetics:
//   - a moderation-declined turn never reached the model, so it lights ONLY the
//     open safety classifier (toxic-bert), never Apertus;
//   - the web-search node appears only when the turn genuinely searched;
//   - the compute cell (CSCS) lights only when the answer TRULY ran on sovereign
//     hardware — i.e. served directly on CSCS, not via the HF prototype host;
//   - otherwise the model node alone.
//
// StackMap feeds the result to its staged (one-stage-at-a-time) reveal. Kept pure
// and exported so the honesty invariant is unit-tested without a component
// harness — the staging *timing* is cosmetic and intentionally untested.

// SINGLE SOURCE OF TRUTH for live-stack node ids. Every surface that lights/flashes/
// pulses a map node imports these — never a bare "apertus"/"websearch" literal — so a
// rename in static/data/stack-map.json can't silently leave a dispatcher pointing at a
// dead node (reveal.spec.ts asserts each id exists in the map). Before this, the ids
// were restated across 8+ components and had already drifted (model set was ["apertus"]
// here but ["apertus","cscs"] in the streaming pulse).
export const MODEL_NODES = ["apertus"] as const;

// The sovereign compute cell in stack-map.json. Lights per answer only when the
// model genuinely executes here (resolveServing().isSovereign), so the map can
// never claim Swiss hardware while we're HF-served.
export const COMPUTE_NODE = "cscs";

// The open web-retrieval node; the HF-router hop (second-opinion / compare models);
// the open safety pre-screen (toxic-bert). Bundled here so all dispatchers agree.
export const WEBSEARCH_NODE = "websearch";
export const ROUTER_NODE = "router";
export const SAFETY_NODES = ["toxicbert"] as const;

// Every node id this module is authoritative for — used by the test that pins them to
// stack-map.json. Order/dupes don't matter (it's an existence check).
export const ALL_STACK_NODE_IDS = [
	...MODEL_NODES,
	COMPUTE_NODE,
	WEBSEARCH_NODE,
	ROUTER_NODE,
	...SAFETY_NODES,
] as const;

export function computeRevealStages(
	answer: {
		moderation?: { flagged?: boolean } | null;
		webSearch?: { sources?: unknown[] } | null;
	},
	opts?: { servedOnSovereignCompute?: boolean }
): string[] {
	// A declined message never ran the model — credit only what actually ran (the
	// safety pre-screen). It never reached the model-on-compute path, so no compute.
	if (answer.moderation?.flagged) return [...SAFETY_NODES];
	// Search grounds the answer first, then the model produces it: search → model.
	const searched = !!answer.webSearch?.sources?.length;
	const stages = searched ? [WEBSEARCH_NODE, ...MODEL_NODES] : [...MODEL_NODES];
	// …and when the model ran on sovereign compute, credit the hardware it ran on.
	return opts?.servedOnSovereignCompute ? [...stages, COMPUTE_NODE] : stages;
}

// Nodes to PULSE live while a turn is still streaming — the layers genuinely running
// right now. Same honesty gates as computeRevealStages (which runs at turn END): the
// model always; web-search only when the turn is grounded; sovereign compute ONLY when
// the answer truly runs on it. This is the authority the inline trace's streaming pulse
// must use, so the live map can never flash "CSCS" while we're HF-served.
export function computePulseNodes(opts: {
	grounded?: boolean;
	servedOnSovereignCompute?: boolean;
}): string[] {
	const nodes: string[] = [...MODEL_NODES];
	if (opts.grounded) nodes.push(WEBSEARCH_NODE);
	if (opts.servedOnSovereignCompute) nodes.push(COMPUTE_NODE);
	return nodes;
}
