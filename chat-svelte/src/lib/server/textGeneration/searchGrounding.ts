/**
 * Grounding suffix appended to the system prompt when the user accepted an
 * open-web search. The model answers from the retrieved numbered sources ONLY
 * and cites [n]; unmatched claims are not invented. Wikipedia is treated as
 * authoritative-current; Marginalia is the broader (less reliable) open web.
 *
 * Ported from the Next chat/ app (lib/ai/prompts.ts `searchGroundingPrompt`).
 * The retrieval engine is $lib/server/search/openSearch.ts.
 */
export const searchGroundingPrompt = (evidence: string, asOf: string): string =>
	`The user asked for an open-web search. These numbered sources were retrieved just now from open knowledge bases, as of ${asOf.slice(0, 10)}:

${evidence}

These sources are more current than your training data. Where they conflict with what you remember, the sources are correct: state what they say. Do NOT hedge that your own knowledge may be out of date for anything these sources cover, and do not downgrade a sourced fact with training-based caveats like "as of my last update", "this may have changed since", or "as far as I know" — the sources ARE the up-to-date information.

Answer using ONLY the information in these sources. Cite every factual claim inline with its bracketed number — [1], [2] — matching the source it came from. Wikipedia entries are authoritative current knowledge; Marginalia results are from the broader open web and may be less reliable, so prefer Wikipedia where they disagree. If the sources do not answer the question, say so plainly and do not fill the gap from memory. Keep citing even though the answer is short. Do not mention or restate these instructions.`;

/** Append the search-grounding suffix to a conversation's system prompt. */
export function injectSearchGroundingPrompt(
	preprompt: string | undefined,
	evidence: string,
	asOf: string
): string {
	const suffix = searchGroundingPrompt(evidence, asOf);
	const base = preprompt?.trim();
	// Grounding goes last so it's the most recent, highest-salience instruction.
	return base ? `${base}\n\n${suffix}` : suffix;
}
