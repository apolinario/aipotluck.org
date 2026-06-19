// Lightweight, no-LLM heuristic for "this question wants current/external info
// the model can't know from training" — used to surface the "search open
// sources?" affordance in the composer. Deliberately conservative: it only
// *offers* search; the user always decides, and a manual search toggle is
// always available regardless. Client-safe (no server deps). Ported from chat/.

const RECENCY_RE =
	/\b(current(ly)?|latest|recent(ly)?|today|now|this (year|month|week)|right now|as of|up[- ]?to[- ]?date|newest|status of|state of|202[4-9]|203\d|breaking|news|just (happened|announced)|so far)\b/i;

// "how do you find that / can you look that up" — the documented citizen scenario.
const LOOKUP_RE =
	/\b(how (do|would|can) you (find|know|look|search)|look (this|that|it) up|search (the web|online|for)|find out|fact[- ]?check)\b/i;

export function isRecencyQuery(text: string): boolean {
	const t = (text ?? "").trim();
	if (t.length < 3) {
		return false;
	}
	return RECENCY_RE.test(t) || LOOKUP_RE.test(t);
}

// Coding/technical how-to context: "current/status/latest/now" are false recency
// triggers here ("how do I get the current date in Python?", "git status"). De-noising
// against this lifted the heuristic's specificity 60%→100% on the eval (the held-out set
// confirmed it generalizes for the COMMON languages/tools below; it leaks on rarer ones,
// which is acceptable — the model classifier backstops, and a stray search is cheap).
// Keyword list deliberately moderate (not held-out-tuned) — see evals/search-decision.
const TECHNICAL_RE =
	/\b(python|javascript|typescript|java|c\+\+|c#|rust|go(?:lang)?|ruby|php|swift|kotlin|bash|shell|zsh|powershell|sql|git|github|docker|kubernetes|k8s|systemd|linux|unix|npm|node|deno|regex|css|html|json|yaml|api|sdk|cli|terminal|compiler|runtime|function|variable|array|string|integer|command|circuit|resistor|voltage|ohm|capacitor|timestamp|working directory)\b/i;

/** True when the query reads as a coding/technical how-to (where recency words are false
 *  triggers). Pure + exported for testing. */
export function isTechnicalContext(text: string): boolean {
	return TECHNICAL_RE.test((text ?? "").trim());
}

/**
 * De-noised recency heuristic: the recency signal, suppressed when the query is an
 * obvious coding/technical how-to. This is the search fast-path used by the composer —
 * raw isRecencyQuery is kept for any caller that wants the unfiltered signal. In the
 * "model"/"tool" strategy a suppressed-but-actually-current query (e.g. "latest Node.js
 * release") still gets caught by the model classifier, so de-noise only ever removes
 * spurious coding searches, never real ones, in those strategies.
 */
export function isRecencyQueryDenoised(text: string): boolean {
	return isRecencyQuery(text) && !isTechnicalContext(text);
}
