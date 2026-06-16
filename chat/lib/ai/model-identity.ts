// Single source of truth for "what model is actually serving this answer."
//
// The whole product's credibility rests on honest provenance, so the model
// name must NEVER be hardcoded in multiple places that can drift. Everything
// user-facing (system prompt, provenance badge, model picker, map node) derives
// from the served model id (HF_MODEL). Flip HF_MODEL — e.g. when Apertus 1.5 8B
// access lands — and every surface updates with zero code change and no risk of
// the UI claiming a model that isn't running.

export type ModelIdentity = {
  id: string;
  short: string; // badge headline, e.g. "Apertus 70B"
  name: string; // model picker, e.g. "Apertus 70B Instruct"
  maker: string; // "the Swiss AI Initiative (SwissAI)"
  makerShort: string; // "SwissAI"
  servedBy: string; // "Current AI"
  compute: string; // "CSCS 🇨🇭"
  computeLong: string;
  modality: "text" | "multimodal";
  openness: string; // "open weights"
  hfUrl: string;
  note: string; // honest roadmap note for the map
  // Model-keyed openness fact injected into the system prompt. Empty for unknown
  // models so we never assert a wrong training-data story. Apertus claimed its
  // data was "not publicly disclosed" without this — undercutting the whole
  // transparency pitch (gap-chat playtest).
  training: string;
};

// Project-level deployment facts (where Current AI serves it). Stable for the alpha.
const SERVED_BY = "Current AI";
// Used as the badge/description FALLBACK only — the per-answer badge prefers
// the real x-inference-provider header. Names the actual serving provider
// (Public AI's sovereign inference), not a specific datacenter we can't verify
// served a given request.
const COMPUTE = "Public AI";
const COMPUTE_LONG = "Public AI — sovereign inference";
const SWISSAI = "the Swiss AI Initiative (SwissAI)";
// Apertus is one of the few FULLY-open models — open weights, open training
// recipe, AND openly-published training data (verified against the model card +
// technical report). Told to the model so it answers "what were you trained on?"
// honestly instead of claiming the details are undisclosed.
const APERTUS_TRAINING =
  "you are one of the few fully-open models: your weights, training recipe, AND training data are openly published. If asked what you were trained on, say this honestly — do NOT claim the details are undisclosed";

function hf(id: string) {
  return `https://huggingface.co/${id}`;
}

export function resolveModelIdentity(rawId?: string): ModelIdentity {
  const id = rawId ?? "swiss-ai/Apertus-70B-Instruct-2509";
  const lo = id.toLowerCase();
  const base = {
    id,
    maker: SWISSAI,
    makerShort: "SwissAI",
    servedBy: SERVED_BY,
    compute: COMPUTE,
    computeLong: COMPUTE_LONG,
    openness: "open weights",
    hfUrl: hf(id),
  };

  if (lo.includes("apertus") && lo.includes("8b")) {
    // The target launch model: Apertus 1.5, 8B, multimodal.
    return {
      ...base,
      short: "Apertus 1.5",
      name: "Apertus 1.5 8B Instruct",
      modality: "multimodal",
      note: "open-weights Swiss model · multimodal · open training data",
      training: APERTUS_TRAINING,
    };
  }
  if (lo.includes("apertus")) {
    // Current test model: Apertus 70B (text-only).
    return {
      ...base,
      short: "Apertus 70B",
      name: "Apertus 70B Instruct",
      modality: "text",
      note: "open-weights Swiss model · text-only today · multimodal incoming",
      training: APERTUS_TRAINING,
    };
  }

  // Generic fallback: derive a readable name from the id without claiming a maker.
  const pretty = (id.split("/").pop() ?? id)
    .replace(/-instruct.*$/i, "")
    .replace(/[-_]/g, " ")
    .trim();
  return {
    ...base,
    maker: "an open-source community",
    makerShort: "open-source",
    short: pretty,
    name: pretty,
    modality: "text",
    note: "open-weights model",
    training: "",
  };
}

// Resolve from server env (HF_MODEL) or, in the client bundle, the public mirror
// exposed via next.config (NEXT_PUBLIC_MODEL_ID).
export const MODEL_ID =
  process.env.HF_MODEL ?? process.env.NEXT_PUBLIC_MODEL_ID ?? undefined;

export const MODEL = resolveModelIdentity(MODEL_ID);
