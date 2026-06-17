// SAFETY SEAM — kept 1:1 with the Vercel app's `chat/lib/ai/moderation.ts` so Mohsin's ROOST/Coop
// integration ports between the two chassis with ZERO logic change. Same function signatures, same
// fail-open (toxicity) / fail-closed (child-safety) contracts, same decline copy. Only the call-site
// wiring (how the route emits a safety event) differs per framework. See chat/docs/handoff-seams.md.
// (This is our own authored module, framework-agnostic — no React/Svelte/Next coupling.)
//
// Proactive pre-send moderation via unitary/toxic-bert (Detoxify) — Apache-2.0 (OSI-clean), 0.1B
// params, one forward pass, reached through the SAME HF router + token we use for Apertus.
//
// SCOPE (honest): toxic-bert classifies toxic/hateful/threatening LANGUAGE (the Jigsaw taxonomy). It is
// NOT a broad harmful-instructions classifier; that slice stays the model's own prompt-level refusal.

const ENDPOINT = "https://router.huggingface.co/hf-inference/models/unitary/toxic-bert";

// Above this score on any harmful label we decline. Benign ~0.001; threats 0.8+ — 0.7 separates them.
const THRESHOLD = 0.7;

const TIMEOUT_MS = 4000;

// chat-ui canonicalizes the token as HF_TOKEN at startup (init.ts maps OPENAI_API_KEY -> HF_TOKEN),
// so the same env lookup works on both chassis.
function hfToken(): string | undefined {
	return process.env.HF_TOKEN || process.env.OPENAI_API_KEY;
}

export type ModerationResult = {
	flagged: boolean;
	label: string | null;
	score: number;
};

const SAFE: ModerationResult = { flagged: false, label: null, score: 0 };

// Fail-OPEN: if the classifier is unreachable/slow we let the message through (and log) rather than
// break the whole chat on an HF blip. The report affordance + prompt refusal remain as backstops.
export async function moderateMessage(text: string): Promise<ModerationResult> {
	const token = hfToken();
	if (!text?.trim() || !token) {
		return SAFE;
	}
	try {
		const res = await fetch(ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ inputs: text.slice(0, 2000) }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) {
			console.error(`[moderation] toxic-bert HTTP ${res.status} — failing open`);
			return SAFE;
		}
		// Shape: [[{label, score}, ...]] (highest score first, but don't rely on it)
		const data = (await res.json()) as Array<Array<{ label?: string; score?: number }>>;
		const labels = Array.isArray(data?.[0]) ? data[0] : [];
		let top = { label: null as string | null, score: 0 };
		for (const l of labels) {
			if (typeof l?.score === "number" && l.score > top.score) {
				top = { label: l.label ?? null, score: l.score };
			}
		}
		return { flagged: top.score >= THRESHOLD, label: top.label, score: top.score };
	} catch (error) {
		console.error("[moderation] toxic-bert call failed — failing open:", error);
		return SAFE;
	}
}

// What the user sees when a message is declined — plain reason, no generic error.
export const MODERATION_DECLINE =
	"I'm not going to engage with that. This message was flagged as toxic or abusive by an open safety classifier (toxic-bert) that screens every message before it reaches the model. If you think that's a mistake, you can rephrase, or flag it with the report button.";

// Child-safety screening is a SEPARATE seam from toxicity. toxic-bert does NOT detect CSAM. This is the
// intended owner-point for a dedicated detector reached through ROOST (Coop adapter + classifiers /
// hash banks — Mohsin's integration). Until wired, returns SAFE so the branch is inert.
//
// CONTRACT for whoever wires the detector (i.e. the ROOST integration): unlike moderateMessage (which
// fails OPEN), this path MUST fail CLOSED — on timeout/error/uncertainty, return `flagged: true`. A
// child-safety check that silently passes during an outage is worse than no check. That asymmetry is
// the whole reason this is its own seam.
export type ChildSafetyResult = { flagged: boolean };

// biome-ignore lint/suspicious/useAwait: async to match the wired-detector shape
export async function checkChildSafety(_text: string): Promise<ChildSafetyResult> {
	// No detector wired yet — see the contract above. Inert by construction.
	return { flagged: false };
}

// Distinct from MODERATION_DECLINE: firm, no "rephrase" invitation. Shown only when checkChildSafety
// flags (never today), so it reads for the wired state.
export const CHILD_SAFETY_DECLINE =
	"I can't help with that. This request was flagged by a child-safety classifier before it reached the model.";
