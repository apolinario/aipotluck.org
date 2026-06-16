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
