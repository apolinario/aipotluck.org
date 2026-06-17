// Proactive pre-send moderation via unitary/toxic-bert (Detoxify) — Apache-2.0
// (OSI-clean, passes the license-credibility gate, unlike the openrail-licensed
// KoalaAI / non-OSI Llama Guard / ShieldGemma), 0.1B params, a single forward
// pass. Reached through the SAME HF router + token we already use for Apertus,
// so no new infra (the alternative, ROOST's Osprey, is a 19-service streaming
// platform that doesn't fit a serverless app).
//
// SCOPE (honest): toxic-bert classifies toxic/hateful/threatening LANGUAGE
// (the Jigsaw taxonomy: toxic, severe_toxic, obscene, threat, insult,
// identity_hate). It is NOT a broad harmful-instructions classifier — e.g.
// "how to build a bomb" scores low here. That slice stays the model's own
// prompt-level refusal. Broader OSI coverage (IBM Granite Guardian, or
// Apertus-as-moderator) is a heavier full-LLM-call follow-up.

const ENDPOINT =
  "https://router.huggingface.co/hf-inference/models/unitary/toxic-bert";

// Above this score on any harmful label we decline. Benign text scores ~0.001;
// harassment/threats score 0.8+ — 0.7 separates them with comfortable margin.
const THRESHOLD = 0.7;

const TIMEOUT_MS = 4000;

export type ModerationResult = {
  flagged: boolean;
  label: string | null;
  score: number;
};

const SAFE: ModerationResult = { flagged: false, label: null, score: 0 };

// Fail-OPEN: if the classifier is unreachable/slow we let the message through
// (and log) rather than break the whole chat on an HF blip. The threat model is
// an internal demo; the report affordance + prompt refusal remain as backstops.
export async function moderateMessage(text: string): Promise<ModerationResult> {
  if (!text?.trim() || !process.env.HF_TOKEN) {
    return SAFE;
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text.slice(0, 2000) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(
        `[moderation] toxic-bert HTTP ${res.status} — failing open`
      );
      return SAFE;
    }
    // Shape: [[{label, score}, ...]] (highest score first, but don't rely on it)
    const data = (await res.json()) as Array<
      Array<{
        label?: string;
        score?: number;
      }>
    >;
    const labels = Array.isArray(data?.[0]) ? data[0] : [];
    let top = { label: null as string | null, score: 0 };
    for (const l of labels) {
      if (typeof l?.score === "number" && l.score > top.score) {
        top = { label: l.label ?? null, score: l.score };
      }
    }
    return {
      flagged: top.score >= THRESHOLD,
      label: top.label,
      score: top.score,
    };
  } catch (error) {
    console.error("[moderation] toxic-bert call failed — failing open:", error);
    return SAFE;
  }
}

// What the user sees when a message is declined — plain reason, no generic
// error, consistent with the persona's "state the plain reason" rule.
export const MODERATION_DECLINE =
  "I'm not going to engage with that. This message was flagged as toxic or abusive by an open safety classifier (toxic-bert) that screens every message before it reaches the model. If you think that's a mistake, you can rephrase, or flag it with the report button.";

// Child-safety screening is a SEPARATE seam from toxicity, deliberately not
// folded into moderateMessage. toxic-bert does NOT detect CSAM or other
// child-sexual-abuse material — it scores the Jigsaw language axes — so reusing
// it here would be a false sense of coverage. There is no open, self-hostable
// CSAM classifier we can call from a serverless app today; the intended owner is
// a dedicated detector reached through ROOST (see the map's ROOST/Osprey nodes).
//
// Until a detector is wired, this returns SAFE: nothing is flagged, so the
// branch is inert and cannot produce a false positive.
//
// CONTRACT for whoever wires the detector: unlike moderateMessage (which fails
// OPEN), this path MUST fail CLOSED — on timeout/error/uncertainty, return
// `flagged: true`. A child-safety check that silently passes during an outage is
// worse than no check. That asymmetry is the whole reason this is its own seam.
export type ChildSafetyResult = { flagged: boolean };

// biome-ignore lint/suspicious/useAwait: async to match the wired-detector shape
export async function checkChildSafety(
  _text: string
): Promise<ChildSafetyResult> {
  // No detector wired yet — see the contract above. Inert by construction.
  return { flagged: false };
}

// Distinct from MODERATION_DECLINE: firm, no "rephrase" invitation. Shown only
// when checkChildSafety flags (never today), so it reads for the wired state.
export const CHILD_SAFETY_DECLINE =
  "I can't help with that. This request was flagged by a child-safety classifier before it reached the model.";
