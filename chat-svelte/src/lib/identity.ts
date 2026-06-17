// Single source of truth for "what model is actually serving this answer."
//
// The whole product's credibility rests on honest provenance, so the model
// name must NEVER be hardcoded in places that can drift. Everything user-facing
// (system prompt, provenance badge, model identity surfaces) derives from the
// served model id. Flip the served model — e.g. when Apertus 1.5 8B access
// lands — and every surface updates with zero code change and no risk of the UI
// claiming a model that isn't running.
//
// This module is CLIENT-SAFE (pure, no $env / server imports), so the provenance
// badge can resolve identity from `message.routerMetadata.model` in the browser.
// persona.ts (server) imports resolveModelIdentity from here so the prompt and
// the badge can never disagree about who made the model.

export type ModelIdentity = {
	short: string; // badge headline, e.g. "Apertus 70B"
	maker: string; // "the Swiss AI Initiative (SwissAI)"
	makerShort: string; // "SwissAI"
	openness: string; // "fully open" | "open weights"
	training: string; // openness fact injected into the prompt; "" for unknown models
};

const SWISSAI = "the Swiss AI Initiative (SwissAI)";

// Apertus is one of the few FULLY-open models — open weights, open training
// recipe, AND openly-published training data (verified against the model card +
// technical report). Told to the model so it answers "what were you trained on?"
// honestly instead of claiming the details are undisclosed (it did, without this).
const APERTUS_TRAINING =
	"you are one of the few fully-open models: your weights, training recipe, AND training data are openly published. If asked what you were trained on, say this honestly — do NOT claim the details are undisclosed";

function apertus(short: string): ModelIdentity {
	return { short, maker: SWISSAI, makerShort: "SwissAI", openness: "fully open", training: APERTUS_TRAINING };
}

// Identity is DERIVED from the served model id, never hardcoded, so no surface
// can claim a model that isn't running. The future multimodal launch model is
// "Apertus 1.5"; only call it that when the id actually says so. The current
// alpha serves the text-only 8B / 70B-2509.
export function resolveModelIdentity(rawId?: string): ModelIdentity {
	const lo = (rawId ?? "").toLowerCase();

	if (lo.includes("apertus")) {
		if (lo.includes("1.5") || lo.includes("multimodal")) return apertus("Apertus 1.5");
		if (lo.includes("70b")) return apertus("Apertus 70B");
		if (lo.includes("8b")) return apertus("Apertus 8B");
		return apertus("Apertus");
	}

	// Generic fallback: a readable name from the id without claiming a maker or a
	// training-data story we can't vouch for.
	const pretty = (rawId?.split("/").pop() ?? rawId ?? "an open model")
		.replace(/-instruct.*$/i, "")
		.replace(/[-_]/g, " ")
		.trim();
	return { short: pretty, maker: "an open-source community", makerShort: "open-source", openness: "open weights", training: "" };
}

// Friendly names for known HF inference providers (the raw header value is a
// slug). Public AI is the sovereign-inference provider serving Apertus here.
const PROVIDER_NAMES: Record<string, string> = {
	publicai: "Public AI",
};

// The third slot of the provenance badge is the ACTUAL inference provider that
// served the answer (read per-request from the HF router's x-inference-provider
// header), not a hardcoded compute box — so the badge can't claim a datacenter
// the request didn't hit. With no provider captured (historical message), fall
// back to the honest serving label rather than inventing one.
export function providerDisplay(provider?: string): string {
	if (!provider) return "Public AI";
	return PROVIDER_NAMES[provider.toLowerCase()] ?? provider.replace(/\b\w/g, (c) => c.toUpperCase());
}
