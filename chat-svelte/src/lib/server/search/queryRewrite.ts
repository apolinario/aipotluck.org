import { getReturnFromGenerator } from "$lib/utils/getReturnFromGenerator";
import { logger } from "$lib/server/logger";
// NOTE: `generateFromDefaultEndpoint` (which pulls the model registry / $env graph) is imported
// DYNAMICALLY inside contextualizeQuery — keeping it off the module's top level lets the pure helpers
// (needsContextualization / sanitizeRewrite) be imported by tests + the eval harness without booting
// the model layer (the same reason searchMargin is split out from searchDecision).

// Conversational query rewriting (coreference resolution) before an open-web search.
//
// A follow-up like "what most recent research says about it?" was being searched VERBATIM — the
// dangling "it" carries no topic, so the open-web search returned junk (observed in a stakeholder
// screenshot: a dinosaur follow-up returned "Whataboutism", "Missing scientists conspiracy theory",
// etc., then cited them). The fix is the standard history-aware retrieval step: rewrite the latest
// message into a STANDALONE query using the recent turns, THEN search.
//
// Two-layer, latency-conscious:
//   1. `needsContextualization` — a deterministic gate (pure). Only context-dependent messages
//      (dangling pronouns / fragment openers) pay for a rewrite; a standalone query searches as-is
//      with zero extra cost. Reused by tests + the eval harness.
//   2. `contextualizeQuery` — a single cheap, best-effort model call that resolves the references.
//      Fails OPEN to the raw query on any error/degenerate output: a bad rewrite must never block or
//      worsen the search (the raw query is the existing behaviour, so we can only improve).

export interface RewriteTurn {
	from: "user" | "assistant";
	content: string;
}

// Referential pronouns that point OUT of the message (need prior context to resolve).
const REFERENTIAL =
	/\b(it|its|it's|this|that|these|those|they|them|their|theirs|the (?:former|latter|first|second|third|last|other)(?:\s+one)?|he|him|his|she|her|hers|one|ones)\b/i;

// Fragment / continuation openers — a message that only makes sense as a follow-up.
const FRAGMENT_OPENER =
	/^(and|but|so|or|also|what about|how about|why|why not|and what|what else|any other|anything else|more|tell me more|go on|continue|elaborate|expand)\b/i;

/**
 * Does this query depend on prior conversation to be searchable on its own? Deterministic + pure.
 * True for dangling pronouns ("…about it") and continuation fragments ("and the second?"); false for
 * a self-contained query ("what is the biggest dinosaur"). Over-triggering is cheap (the rewrite
 * falls back to the original); under-triggering leaves the junk-source bug, so we bias toward true.
 */
export function needsContextualization(query: string): boolean {
	const q = query.trim();
	if (!q) return false;
	return REFERENTIAL.test(q) || FRAGMENT_OPENER.test(q);
}

const REWRITE_PROMPT = `You rewrite a user's latest message into a standalone open-web search query. Resolve any pronouns or references ("it", "that", "they", "the second one") using the conversation so the query is meaningful on its own, with no prior context. Keep it short and search-like. Output ONLY the rewritten query — no quotes, no label, no explanation. If the message is already standalone, output it unchanged.`;

/**
 * Clean the model's rewrite and guard against degenerate output. Pure + testable. Falls back to the
 * original query when the rewrite is empty, over-long (the model rambled), or otherwise unusable.
 */
export function sanitizeRewrite(raw: string, fallback: string): string {
	let s = (raw ?? "").trim();
	if (!s) return fallback;
	// First line only — the model occasionally appends an explanation despite the instruction.
	s = s.split("\n")[0].trim();
	// Strip a leading label ("Standalone search query:", "Query -") and surrounding quotes/backticks.
	s = s.replace(/^(standalone search query|search query|query|search)\s*[:\-–]\s*/i, "").trim();
	s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
	if (!s || s.length > 200) return fallback;
	return s;
}

/**
 * Rewrite `query` into a standalone search query using recent `history`, when it needs it. Best-effort:
 * returns the raw query unchanged when contextualization isn't needed, there's no history, or the
 * model call fails — never throws, never blocks the search.
 */
export async function contextualizeQuery(
	query: string,
	history: RewriteTurn[],
	locals: App.Locals | undefined
): Promise<string> {
	const q = query.trim();
	if (!q || history.length === 0 || !needsContextualization(q)) return q;

	try {
		const { generateFromDefaultEndpoint } = await import(
			"$lib/server/generateFromDefaultEndpoint"
		);
		const convo = history
			.slice(-4)
			.map((m) => `${m.from === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 600)}`)
			.join("\n");
		const raw = await getReturnFromGenerator(
			generateFromDefaultEndpoint({
				messages: [
					{
						from: "user",
						content: `Conversation so far:\n${convo}\n\nLatest user message: "${q}"\n\nStandalone search query:`,
					},
				],
				preprompt: REWRITE_PROMPT,
				generateSettings: { max_tokens: 40, temperature: 0 },
				locals,
			})
		);
		return sanitizeRewrite(String(raw ?? ""), q);
	} catch (e) {
		logger.warn(e, "[search] query contextualization failed — using raw query");
		return q;
	}
}
