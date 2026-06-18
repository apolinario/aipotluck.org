// Decides which live-stack nodes a FINISHED turn lights, in real pipeline order.
//
// Honest by construction — this is a provenance invariant, not cosmetics:
//   - a moderation-declined turn never reached the model, so it lights ONLY the
//     open safety classifier (toxic-bert), never Apertus;
//   - the web-search node appears only when the turn genuinely searched;
//   - otherwise the model node alone.
//
// StackMap feeds the result to its staged (one-stage-at-a-time) reveal. Kept pure
// and exported so the honesty invariant is unit-tested without a component
// harness — the staging *timing* is cosmetic and intentionally untested.

export const MODEL_NODES = ["apertus"] as const;

export function computeRevealStages(answer: {
	moderation?: { flagged?: boolean } | null;
	webSearch?: { sources?: unknown[] } | null;
}): string[] {
	// A declined message never ran the model — credit only what actually ran.
	if (answer.moderation?.flagged) return ["toxicbert"];
	// Search grounds the answer first, then the model produces it: search → model.
	const searched = !!answer.webSearch?.sources?.length;
	return searched ? ["websearch", ...MODEL_NODES] : [...MODEL_NODES];
}
