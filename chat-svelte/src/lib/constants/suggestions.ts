// Launch starter prompts (Alpha launch content §1.3) — one per audience (builder / funder / sharer /
// partner), each engineered to actually exercise a feature, not just gesture at it:
//   - builder → RAG catalog grounding + the "this touches a gap" CTA
//   - funder → open-web search (recency words trip the margin gate) + cited "as of" provenance
//   - sharer → honest machine identity + sovereign-compute provenance
//   - partner → the collective second-opinion panel + honest open-vs-closed framing
// WORKING DEFAULT (2026-06-22): refine the exact wording with Stephanie; the tuning panel can also
// override these live via page.data.starters. If a prompt deliberately surfaces a known stack gap,
// add a matching entry in starterGaps.ts (only when the node genuinely matches — see the funder one).
export const suggestions: string[] = [
	// builder → RAG catalog + gap CTA
	"I'm building a chatbot on open components. What open-source options exist for the model, vector store, and moderation layer — and where is the open stack still thin?",
	// funder → open-web search + citations (recency wording trips the gate; maps to the web-index gap)
	"What's happened with open-source AI funding or policy in the last month? I'm prepping a board decision and need current sources I can check.",
	// sharer → honest identity + sovereign compute
	"My team defaults to ChatGPT. In plain terms — what makes you different, who built you, and where do you actually run?",
	// partner → collective second opinion + honest open-vs-closed
	"People say open models can't keep up with closed ones. Give me your honest take — and can other open models double-check you?",
];
