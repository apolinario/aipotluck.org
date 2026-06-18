// Single source of truth for HOW and WHERE an answer is served — derived from
// config (the inference base URL + the served checkpoint), never hardcoded, so
// every provenance surface states what is ACTUALLY running and can't drift.
//
// identity.ts answers "WHO made the model"; this answers "WHO serves it and on
// what compute". The product's credibility rests on honest provenance: flip the
// serving host (e.g. HF router → CSCS direct) and the hero copy, the map header,
// the welcome modal, the map nodes, AND which compute cell lights per answer all
// update together — no surface can claim Swiss hardware while we're HF-served, or
// vice-versa.
//
// CLIENT-SAFE (pure, no $env / server imports): a `+layout.server.ts` resolves it
// from server config and ships only the derived labels (not the raw URL) to the
// client, where the map and greeting consume it.

export type ServingProvenance = {
	/** Friendly host label, e.g. "HuggingFace" | "CSCS". */
	providerLabel: string;
	/** True when served DIRECTLY on sovereign public compute (CSCS / LUMI), not a prototype host. */
	isSovereign: boolean;
	/** The served checkpoint, e.g. "Apertus-1.5-8B-Instruct-sft-dpo". */
	servedCheckpoint: string;
	/** HF model page for the served checkpoint (best-effort). */
	checkpointUrl: string;

	// Prose — single source of truth. Each surface keeps its own lead-in and
	// renders the matching field below; both host variants are written here so
	// the copy stays honest in either mode.
	/** ChatIntroduction greeting: the serving sentence after "Running on {brand}…". */
	heroServingLine: string;
	/** StackMap "Under the hood" header paragraph. */
	mapHeaderLine: string;
	/** WelcomeModal serving sentence. */
	welcomeServingLine: string;

	// Map-node token replacements (the serving-dependent fragments of stack-map.json).
	/** router node: how provider routing is served right now. */
	routingProvider: string;
	/** cscs node: the parenthetical describing whether THIS prototype runs on CSCS yet. */
	cscsServingNote: string;
};

type HostFacts = { label: string; sovereign: boolean };

// Known inference hosts. router.huggingface.co = the HF prototype host (fast to
// stand up, but not sovereign). api.swissai.svc.cscs.ch = CSCS direct, the Swiss
// National Supercomputing Centre — sovereign public compute, the production target.
const KNOWN_HOSTS: Record<string, HostFacts> = {
	"router.huggingface.co": { label: "HuggingFace", sovereign: false },
	"api.swissai.svc.cscs.ch": { label: "CSCS", sovereign: true },
};

// Served checkpoints whose HF model page is PUBLIC — safe to deep-link from the
// "Open weights" control on the provenance map. The CSCS-served 1.5 research
// builds (sft-dpo / sft-dpo-tools) return 401 on huggingface.co (unpublished), so
// linking them directly would 401 a public visitor and break the open-weights
// story. For anything not known-public we fall back to the SwissAI org page,
// which is always public and on-brand (the served checkpoint NAME still shows in
// the map copy, so we stay honest about exactly what's running).
const PUBLIC_MODEL_PAGES = new Set([
	"swiss-ai/Apertus-70B-Instruct-2509",
	"swiss-ai/Apertus-8B-Instruct-2509",
]);
const SWISSAI_ORG_URL = "https://huggingface.co/swiss-ai";

function hostOf(baseURL?: string): string {
	try {
		return baseURL ? new URL(baseURL).host : "";
	} catch {
		return "";
	}
}

export function resolveServing(baseURL?: string, servedModelId?: string): ServingProvenance {
	const host = hostOf(baseURL);
	const known = KNOWN_HOSTS[host];
	const providerLabel = known?.label ?? (host || "the configured endpoint");
	const isSovereign = known?.sovereign ?? false;

	const servedCheckpoint = servedModelId?.split("/").pop() || "the configured model";
	const checkpointUrl =
		servedModelId && PUBLIC_MODEL_PAGES.has(servedModelId)
			? `https://huggingface.co/${servedModelId}`
			: SWISSAI_ORG_URL;

	if (isSovereign) {
		// Served directly on sovereign public compute — say so plainly. No
		// "production stack is elsewhere" hedge: this IS the sovereign target.
		return {
			providerLabel,
			isSovereign,
			servedCheckpoint,
			checkpointUrl,
			heroServingLine: `This prototype runs on sovereign public compute at ${providerLabel} in Switzerland — not a company.`,
			mapHeaderLine: `This prototype runs directly on ${providerLabel} — the sovereign public compute shown below.`,
			welcomeServingLine: `This prototype is served on sovereign public compute at ${providerLabel} (Switzerland), via the Public AI Inference Utility, with LUMI (Finland) as a further production target.`,
			routingProvider: `live (direct OpenAI-compatible serving on ${providerLabel})`,
			cscsServingNote: "and now serves this prototype directly",
		};
	}

	// Prototype host (HuggingFace or unknown): honest prototype-vs-production hedge.
	return {
		providerLabel,
		isSovereign,
		servedCheckpoint,
		checkpointUrl,
		heroServingLine: `This prototype is served via ${providerLabel}; the production stack runs on sovereign public compute. Not a company.`,
		mapHeaderLine: `This prototype is served via ${providerLabel} for speed; the production stack runs on the sovereign compute shown below.`,
		welcomeServingLine: `This prototype is served via ${providerLabel} Inference and the Public AI Inference Utility; the production stack is being built on sovereign public compute at CSCS (Switzerland) and LUMI (Finland).`,
		routingProvider: `already live via ${providerLabel}`,
		cscsServingNote: `this prototype is served via ${providerLabel}, not yet from CSCS`,
	};
}
