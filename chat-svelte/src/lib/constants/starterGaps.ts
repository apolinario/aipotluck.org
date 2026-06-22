// Maps a curated starter / on-stage demo prompt to the open-stack gap it deliberately
// surfaces, so the chat can offer an honest "this touches a gap → get involved" CTA
// deep-linked to the right live-stack node. This is the chat side of two launch goals:
// launch content §1.3 (each demo prompt ships a "Map effect" that NAMES a gap) and the
// re-ranked backlog note #4 (chat should surface gaps in the map with a get-involved CTA).
//
// HONESTY RULE — load-bearing: only curated prompts whose gap we genuinely know get an
// entry here. We never INFER a gap from free-form model output (that would fabricate
// provenance, the one thing the product can't do). A prompt with no entry shows no CTA.
//
// `node` is an id in static/data/stack-map.json (the node the CTA pulses + deep-links).
// `ask` is the open contribution the gap needs — shown in the CTA and prefilled into the
// Raise-your-hand form's detail (via the contributeOpen store's { topic }).

export interface StarterGap {
	node: string;
	ask: string;
}

// Keyed by the prompt text. Kept SEPARATE from `suggestions` (string[]) so the starters
// list and the tuning-panel starters default stay a plain string array, untouched.
//
// CURATION RULE (learned the hard way, 2026-06-19): an entry is only honest if the node it
// deep-links to ACTUALLY MATCHES the ask. We deliberately do NOT have a farmer→local-data
// entry: the farmer prompt's real gap is "no local agricultural dataset behind the model",
// but the map has no data/dataset node — the nearest candidate, `localculture`, is actually
// "community self-configuration of a deployment", an unrelated topic. Pointing there would
// misrepresent the gap. That entry waits on a real data node in static/data/stack-map.json
// (a Carl/Josh/Laura content call), not a forced mis-aim.
// Keyed by the EXACT starter-prompt text (see suggestions.ts). Honour the CURATION RULE above: only
// an entry whose node ACTUALLY matches the ask. The funder prompt searches the open web, which is the
// exact gap the `websearch` node names ("a Google-scale open web index is still the honest gap") — so
// it earns a CTA. The builder prompt ("where is the open stack thin?") spans several layers with no
// single matching node, so it deliberately gets NO entry rather than a forced mis-aim.
const GAPS: Record<string, StarterGap> = {
	"What's happened with open-source AI funding or policy in the last month? I'm prepping a board decision and need current sources I can check.":
		{ node: "websearch", ask: "a Google-scale open web search index" },
};

/** Collapse whitespace + case so a chip click and a pasted/typed copy of the same prompt
 *  both match. Pure. */
export function normalizeStarter(text: string): string {
	return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const BY_NORM: Record<string, StarterGap> = Object.fromEntries(
	Object.entries(GAPS).map(([k, v]) => [normalizeStarter(k), v])
);

/** The gap a curated prompt deliberately surfaces, or undefined for prompts that don't
 *  target one (e.g. the provenance/governance starter). Matches on normalized text. */
export function gapForPrompt(text: string | undefined | null): StarterGap | undefined {
	if (!text) return undefined;
	return BY_NORM[normalizeStarter(text)];
}
