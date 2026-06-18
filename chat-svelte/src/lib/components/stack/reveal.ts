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

export const MODEL_NODES = ["apertus"] as const;

// The sovereign compute cell in stack-map.json. Lights per answer only when the
// model genuinely executes here (resolveServing().isSovereign), so the map can
// never claim Swiss hardware while we're HF-served.
export const COMPUTE_NODE = "cscs";

export function computeRevealStages(
	answer: {
		moderation?: { flagged?: boolean } | null;
		webSearch?: { sources?: unknown[] } | null;
	},
	opts?: { servedOnSovereignCompute?: boolean }
): string[] {
	// A declined message never ran the model — credit only what actually ran (the
	// safety pre-screen). It never reached the model-on-compute path, so no compute.
	if (answer.moderation?.flagged) return ["toxicbert"];
	// Search grounds the answer first, then the model produces it: search → model.
	const searched = !!answer.webSearch?.sources?.length;
	const stages = searched ? ["websearch", ...MODEL_NODES] : [...MODEL_NODES];
	// …and when the model ran on sovereign compute, credit the hardware it ran on.
	return opts?.servedOnSovereignCompute ? [...stages, COMPUTE_NODE] : stages;
}
