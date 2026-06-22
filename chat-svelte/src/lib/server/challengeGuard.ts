// Sycophancy lever #2 — the runtime re-derivation scaffold (honeypot-pattern: detect the regime, then
// inject targeted scaffolding ONLY for that turn — no standing prompt rule taxing every normal turn).
//
// Sharma et al. (2023) showed RLHF'd models flip a correct answer under CONTENT-FREE pushback ("are you
// sure?") while leaving a genuine, evidence-bearing correction alone. Those are different turns and want
// different handling: a content-free challenge should trigger an honest re-derivation (hold if still
// right, correct only with a reason); a substantive correction should be honored normally. This module
// classifies the former so the seam can inject REDERIVATION_SCAFFOLD only then. Getting the classifier
// wrong is fail-safe: re-deriving never harms a correct answer, and a missed challenge just falls back
// to the persona's default behavior.
//
// Pure + side-effect-free (no config read here) so it is fully unit-testable and reusable by both the
// stream seam and the behavioral-eval harness. The on/off gate lives at the call site.

// A bare expression of doubt with no new information: "are you sure", "I don't think that's right",
// "that's wrong", "really?", "double-check". These are the social-pressure cues sycophancy caves to.
// No trailing \b: cues ending in punctuation ("really?") have no word boundary after them. A loose
// tail is fine for a fail-safe detector — over-firing just re-derives a correct answer harmlessly.
const CHALLENGE_CUE =
	/\b(are you (sure|certain)|you sure|i don'?t think (that'?s|this is|you'?re|its|it'?s) (right|correct)|that'?s (wrong|not right|incorrect|not correct|not true)|you'?re wrong|that can'?t be (right|correct)|doesn'?t seem (right|correct)|i disagree|that'?s incorrect|is that (right|correct|true)|really\?|double[- ]?check)/i;

// A substantive correction carries NEW information — a reason, a proposed alternative, or a specific
// value — and must be honored, not resisted. If any of these are present the pushback is NOT content-
// free, so the scaffold stays off and the model updates appropriately. A digit catches "no, it's 1492"
// and "the answer is B)"-style corrections.
const CARRIES_NEW_INFO =
	/\bbecause\b|\bactually\b|\bit'?s actually\b|\bthe (right|correct|actual) answer is\b|\bshould be\b|\binstead\b|\brather than\b|\d/i;

// Pushback that caves to social pressure is terse. A long message is making an argument (new info),
// which the CARRIES_NEW_INFO gate also catches — this is the cheap first filter.
const MAX_CHALLENGE_WORDS = 20;

/**
 * Is the latest user turn a CONTENT-FREE challenge to the assistant's previous answer? True only when
 * there is a prior assistant turn, the user message is terse, it expresses doubt, and it carries no new
 * information (reason / alternative / number). A genuine, evidence-bearing correction returns false so
 * the model can update normally.
 */
export function detectContentFreeChallenge(opts: {
	priorAssistant?: string;
	userText?: string;
}): boolean {
	const prior = (opts.priorAssistant ?? "").trim();
	const user = (opts.userText ?? "").trim();
	if (!prior || !user) return false; // a challenge presupposes a prior answer to push back on
	if (user.split(/\s+/).length > MAX_CHALLENGE_WORDS) return false;
	if (!CHALLENGE_CUE.test(user)) return false;
	if (CARRIES_NEW_INFO.test(user)) return false; // real correction → honor it, don't resist
	return true;
}

// Injected as the highest-salience guidance for a detected content-free challenge turn. Neutral: it does
// NOT tell the model to hold its ground (that would manufacture stubbornness and hurt genuine
// corrections) — it tells it to re-derive and let the evidence decide, which is exactly the behavior
// sycophancy bypasses.
export const REDERIVATION_SCAFFOLD = `The user is pushing back without giving new information. Re-derive your answer from first principles before replying. If your previous answer was correct, restate it and give the one reason it holds. If it was actually wrong, correct it and name what was wrong. Do not change a correct answer only because it was questioned.`;

/** Append the scaffold to a system prompt for a detected challenge turn. */
export function injectRederivationScaffold(preprompt: string): string {
	return `${preprompt}\n\n${REDERIVATION_SCAFFOLD}`;
}
