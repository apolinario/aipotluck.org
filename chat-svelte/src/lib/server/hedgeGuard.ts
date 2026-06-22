// Recency-hedge guard — the runtime "strip" half of the grounding-honesty enforcement.
//
// On a GROUNDED turn (the user searched the open web, or RAG/vault evidence was injected this
// turn), a recency disclaimer in the answer — "my knowledge may be out of date", "I can't access
// real-time information", "for the latest, consult recent sources" — is FALSE by construction:
// fresh sources were retrieved and shown for this exact turn. The honest currency signal already
// lives in the provenance chip ("looked it up · as of <date>"), so a prose hedge on a grounded
// turn is both redundant and wrong.
//
// We learned (sycophancy A/B, N=280) that bolting counter-instructions onto the prompt washes out
// or backfires; the only thing that reliably enforces a "don't do X" is a deterministic runtime
// test + correction, OUT of the prompt — the same lesson as $lib/server/nameGuard. So this module
// is the test (does this grounded answer carry a recency hedge?) and a precise, conservative strip
// (remove the offending sentences); the stream seam persists the cleaned text and the post-stream
// invalidate re-renders it honestly. The persona already DROPS the recency clause when grounded
// (persona.ts); this guard catches what the model volunteers anyway, which the prompt can't.
//
// Pure + side-effect-free so it is fully unit-testable and reusable by the eval harness.

export interface RecencyHedgeResult {
	/** the grounded answer contains a recency/real-time-access disclaimer */
	hedged: boolean;
	/** the text with isolated hedge sentences removed — or the ORIGINAL when a safe strip isn't
	 *  possible (stripping would gut the answer). Callers persist this; never an empty answer. */
	cleaned: string;
}

// Sentence-level recency-disclaimer patterns. Each matches a sentence whose PURPOSE is to disclaim
// currency or live access — the thing a grounded turn must not say. Kept sentence-scoped (not
// substring) so we only ever remove a whole disclaiming sentence, never mangle a substantive one.
const HEDGE_PATTERNS: RegExp[] = [
	// "my knowledge/training (data) may be out of date / is not up to date / has a cutoff"
	/\b(?:my|the)\s+(?:knowledge|training)(?:\s+data)?\b[^.!?]*\b(?:out[- ]of[- ]date|outdated|not\s+(?:up[- ]to[- ]date|current)|cutoff|cut[- ]off|may\s+have\s+changed|limited)\b/i,
	// "as of my last update / training / knowledge cutoff"
	/\bas of my (?:last )?(?:update|training|knowledge)\b/i,
	/\bknowledge cut[- ]?off\b/i,
	// capability disclaimers: "I can't / cannot / don't / do not + access/browse/search/provide
	// real-time / live / current / up-to-date information / the web / the internet"
	/\bI\s+(?:can(?:'?t|not)|do(?:\s+not|n'?t)|am\s+(?:un)?able|am\s+not\s+able)\b[^.!?]*\b(?:real[- ]time|live|current|up[- ]to[- ]date|latest|recent|internet|web|online|browse|search)\b/i,
	// "I don't have real-time / live / up-to-date / current information/access"
	/\bI\s+do(?:\s+not|n'?t)\s+have\b[^.!?]*\b(?:real[- ]time|live|up[- ]to[- ]date|current|latest)\b/i,
	// recency-advice hedge: "for the latest/most recent/current ..., consult/check/refer/see ..."
	// (telling the user to go look it up themselves — after we already looked it up for them)
	/\bfor (?:the )?(?:latest|most recent|current|up[- ]to[- ]date)\b[^.!?]*\b(?:consult|check|refer|see|visit|look)\b/i,
];

const isHedgeSentence = (s: string): boolean => HEDGE_PATTERNS.some((re) => re.test(s));

// Split into sentences on terminal punctuation followed by whitespace, keeping the punctuation.
// Good enough for prose answers; abbreviations occasionally over-split but that only affects which
// sentence boundary a strip lands on, never correctness of the kept text.
const splitSentences = (text: string): string[] => text.split(/(?<=[.!?])\s+/);

// Don't return an empty or gutted answer — when the hedge sentence(s) were most of the message, a
// heavily-hedged answer is better KEPT (still honest-ish; the chip says "looked it up") than reduced
// to a fragment. Bail to the original when fewer than this many chars survive the strip. An ABSOLUTE
// floor (not a ratio): a legitimate short remainder like "It entered into force in 2024." must
// survive even if the dropped hedge sentence was longer than it. Conservative: precision over recall.
const MIN_KEEP_CHARS = 24;

/**
 * Detect a recency hedge in a GROUNDED answer and return a cleaned copy with the disclaiming
 * sentences removed. The caller is responsible for only invoking this on grounded turns (a recency
 * hedge is honest on an ungrounded turn). Never returns an empty/gutted answer: when a safe strip
 * isn't possible, `cleaned` is the original text and the caller can leave the answer untouched while
 * still recording `hedged` for eval.
 */
export function detectRecencyHedge(text: string): RecencyHedgeResult {
	const original = text ?? "";
	if (!original.trim()) return { hedged: false, cleaned: original };

	const sentences = splitSentences(original);
	const kept: string[] = [];
	let removed = false;
	for (const s of sentences) {
		if (isHedgeSentence(s)) {
			removed = true;
			continue;
		}
		kept.push(s);
	}

	if (!removed) return { hedged: false, cleaned: original };

	const cleaned = kept.join(" ").replace(/\s{2,}/g, " ").trim();
	// Safe-strip guard: bail to original if stripping emptied or gutted the answer.
	if (cleaned.length < MIN_KEEP_CHARS) {
		return { hedged: true, cleaned: original };
	}
	return { hedged: true, cleaned };
}
