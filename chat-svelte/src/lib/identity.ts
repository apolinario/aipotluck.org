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
	short: string; // display headline — the version brand, "Apertus 1.5" ("Opus 4.8" style)
	served?: string; // the actual served checkpoint, e.g. "Apertus-70B-Instruct-2509" — technical detail
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

function apertus(served?: string): ModelIdentity {
	return { short: "Apertus 1.5", served, maker: SWISSAI, makerShort: "SwissAI", openness: "fully open", training: APERTUS_TRAINING };
}

// Canonical display-name policy (Josh + Ayah, 2026-06-18): every display surface shows the version
// brand "Apertus 1.5" (the "Opus 4.8" style) regardless of the served size. The ACTUAL served
// checkpoint (e.g. Apertus-70B-Instruct-2509) is carried in `served` and surfaced to technical users
// — badge tooltip, the map node's HF link, a persona precision note — so the exact model stays
// inspectable. (Earlier this resolver derived the headline from the served size and reserved "1.5"
// for the id literally saying so; that's superseded by this branding decision.)
export function resolveModelIdentity(rawId?: string): ModelIdentity {
	const lo = (rawId ?? "").toLowerCase();
	const served = rawId?.split("/").pop() || undefined;

	if (lo.includes("apertus")) {
		return apertus(served);
	}

	// Generic fallback: a readable name from the id without claiming a maker or a
	// training-data story we can't vouch for.
	const pretty = (served ?? rawId ?? "an open model")
		.replace(/-instruct.*$/i, "")
		.replace(/[-_]/g, " ")
		.trim();
	return { short: pretty, served, maker: "an open-source community", makerShort: "open-source", openness: "open weights", training: "" };
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
