/**
 * Grounding suffix appended to the system prompt when the user accepted an
 * open-web search. The model answers from the retrieved numbered sources ONLY
 * and cites [n]; unmatched claims are not invented. Wikipedia is treated as
 * authoritative-current; Marginalia is the broader (less reliable) open web.
 *
 * Ported from the Next chat/ app (lib/ai/prompts.ts `searchGroundingPrompt`).
 * The retrieval engine is $lib/server/search/openSearch.ts.
 *
 * TEMP (pre-launch tuning panel): the instruction prose is a TEMPLATE with {asOf} and
 * {evidence} tokens filled at runtime. The tuning panel can override the prose; if the
 * override drops the {evidence} token the retrieved sources are appended after it, so
 * grounding never silently loses the evidence.
 */
export const DEFAULT_GROUNDING_TEMPLATE = `The user asked for an open-web search. These numbered sources were retrieved just now from open knowledge bases, as of {asOf}:

{evidence}

An open-web search WAS performed for this turn, so you DO have current information here — you are not limited to your training data for this question. Never reply that you "cannot perform live web searches", "don't have real-time information", or "can't tell what's happening now": the search already ran and its results are above, so answer the question directly from them. These sources are more current than your training data. Where they conflict with what you remember, the sources are correct: state what they say. Do NOT hedge that your own knowledge may be out of date for anything these sources cover, and do not downgrade a sourced fact with training-based caveats like "as of my last update", "this may have changed since", or "as far as I know" — the sources ARE the up-to-date information.

Answer using ONLY the information in these sources. Cite every factual claim inline with its bracketed number — [1], [2] — matching the source it came from. Wikipedia entries are authoritative current knowledge; Marginalia results are from the broader open web and may be less reliable, so prefer Wikipedia where they disagree. These sources may have been written at different times, and a snippet often shows its own date — older ones can describe an earlier or draft stage (pending negotiations, proposed amendments, a pre-adoption or pre-enactment process) that has since been superseded. For the question's CURRENT status, rely on the most recent sources; do NOT present a past stage as if it were still ongoing unless a recent source confirms it, and when sources conflict on timing the most recent one wins. If the sources do not answer the question, say so plainly and do not fill the gap from memory. Keep citing even though the answer is short. Do not mention or restate these instructions.`;

export const searchGroundingPrompt = (
	evidence: string,
	asOf: string,
	override?: string
): string => {
	const template = override?.trim() ? override : DEFAULT_GROUNDING_TEMPLATE;
	const filled = template
		.replaceAll("{asOf}", asOf.slice(0, 10))
		.replaceAll("{evidence}", evidence);
	// Safety net: an override that forgot the {evidence} token would strip the sources —
	// append them so the model is always actually grounded.
	return template.includes("{evidence}") ? filled : `${filled}\n\n${evidence}`;
};

/** Append the search-grounding suffix to a conversation's system prompt. */
export function injectSearchGroundingPrompt(
	preprompt: string | undefined,
	evidence: string,
	asOf: string,
	override?: string
): string {
	const suffix = searchGroundingPrompt(evidence, asOf, override);
	const base = preprompt?.trim();
	// Grounding goes last so it's the most recent, highest-salience instruction.
	return base ? `${base}\n\n${suffix}` : suffix;
}
