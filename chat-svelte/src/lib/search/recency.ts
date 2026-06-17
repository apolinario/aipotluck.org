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
