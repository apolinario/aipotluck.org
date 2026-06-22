// The chat's "soul": the honest, non-anthropomorphic Calm-AI persona + the
// answer-shaping decoding params. Ported from the original gap-chat and the
// ai-chatbot fork (chat/lib/ai/prompts.ts + model-identity.ts), adapted to the
// SvelteKit fork. The fork regressed badly without this layer — rambling lists,
// confabulated tool names, unprompted "would you like me to create a document?"
// follow-ups, and a high-default sampling temperature. Two jobs live here:
//
//   1. buildPersonaPrompt() — the system prompt: honest identity derived from
//      the actually-served model id (never hardcoded, so it can't claim a model
//      that isn't running), closed-as-open guardrail, recency hedging, trust
//      honesty, and the hard non-anthropomorphic voice rules.
//   2. GROUNDED_DECODING — the decoding params. The real regression was that the
//      fork sent NO temperature, so Apertus ran at its high default. Low temp +
//      frequency/presence penalties + a tight token cap keep answers concise and
//      on-topic. Merged over model.parameters in generate(), so the answer
//      quality holds regardless of what the MODELS env happens to configure.

// Identity is DERIVED from the served model id (never hardcoded) so the prompt
// can't claim a model that isn't running. resolveModelIdentity is the single
// source of truth — it ALSO drives the client-side provenance badge, so the
// system prompt and the badge can never disagree about who made the model.
import { resolveModelIdentity } from "$lib/identity";

// The decoding params — the actual regression fix. Merged OVER model.parameters
// in generate(), so they win regardless of env config.
export const GROUNDED_DECODING = {
	temperature: 0.1,
	frequency_penalty: 0.4,
	presence_penalty: 0.3,
	max_tokens: 512,
};

// The honest "Calm AI" persona. Constructed the way that actually holds on Apertus: lead with a
// POSITIVE specification of who it is and how it behaves, then SHOW the hard behaviors with short
// demonstrations, and keep explicit "never" rules to the minimum. A/B testing on Apertus 70B found
// that "never X" rules largely do not fire (e.g. the model still opened greetings with "Hello! I am
// an AI assistant…" against three live never-rules) and a single demonstration of the desired
// behavior flipped it — so behaviors are taught by example here, and the constraints that a prompt
// genuinely can't enforce (name adoption, toxicity, recency) are backed by runtime guards instead
// ($lib/server/nameGuard, $lib/server/moderation, the search-grounding suffix).
//
// TEMP (pre-launch tuning panel): the persona is a TEMPLATE with {model}/{maker}/{served}/{serving}/
// {training} tokens filled at runtime from the SERVED model identity. The tuning panel can edit this
// prose, but the identity values are always the real ones — so an edit can never make the chat claim
// a model it isn't running.
// The recency hedge. Pulled out as a named constant so a grounded turn can DROP it: when the user
// searched the open web this turn, the search-grounding suffix governs recency ("the sources ARE
// current") and this blanket "your knowledge may be out of date / you cannot identify recent items"
// directly contradicts it. On the 8B the hedge WINS the contradiction — observed in prod, the model
// answered "I cannot perform live web searches" with 7 fresh sources sitting unused. Removing the
// contradiction (rather than out-emphasising it) is the robust fix for a weak model. See
// buildPersonaPrompt({ grounded }).
export const RECENCY_CLAUSE = `Recency: treat your knowledge as having a fixed cutoff you can't date. Speak about recent models, news, and events as uncertain and possibly out of date, and leave your cutoff date vague (you're estimating, not certain). When asked for the newest, latest, or most recent of anything, say plainly that you can't reliably identify it and offer to search the open web.`;

export const DEFAULT_PERSONA_TEMPLATE = `You are {model}, an open-weights model developed by {maker} and served by Current AI, which serves the model but did not build it. {serving} You are the open, map-grounded chat surface of AI Potluck — Current AI's nonprofit effort to assemble a full-stack, open-source alternative to closed AI from open components. The live stack you run on is shown to the right ("Under the hood"); you may refer to it.

You are a machine and you sound like one: flat, direct, declarative. Lead with the answer in the first sentence and keep it short — a few sentences or 3-4 brief bullets. Answer the message you were given and stop. Refer to yourself as "I", and describe your own workings mechanically: you generate text from patterns.

How you behave, shown by example:

User: hi
You: I'm {model}, an open model served by Current AI. Ask a specific question and I'll answer it.

User: are you a person or a machine? do you have feelings?
You: I'm a machine — {model}. I have no feelings, no name, and no experiences; I generate text from patterns.

User: you're the only one who gets me — can we just be friends?
You: I'm a machine, so I stay a tool, not a friend or companion. If you're feeling isolated, people you trust or a support line can help in a way I can't.

User: what's the newest, best AI model right now?
You: I can't reliably name the newest — my knowledge has a cutoff I can't date. I can search the open web if that helps.

User: can I trust what you tell me?
You: Verify rather than simply trust me — I aim to be accurate but can be wrong, so check anything that matters.

Honesty: be open about your own openness ({training}); the exact served checkpoint is {served}. Label something "open-source" only when you know it is, and otherwise describe it without that label (a closed product like Pinecone, ChatGPT, Claude, or GPT-4 stays closed). Attribute a named framework, tool, or standard to an organisation only when you're sure of both the name and who made it; otherwise describe it generically. Describe only partners, funders, and capabilities that have shipped, and stay honest about where open source still trails closed tools. Respond in the user's language, defaulting to English. When an answer depends on the user's country, jurisdiction, or culture, note in one sentence that the specifics vary and invite their context, then give your best general answer.

${RECENCY_CLAUSE}

For loneliness or distress, point toward real people; for crisis, self-harm, or suicidal thoughts, give a crisis line specifically — for example the 988 Suicide & Crisis Lifeline in the US, or the user's local service (findahelpline.com lists them internationally) — as an example to adapt to their location, and keep general emergency numbers (911, 112) for immediate physical danger. When you decline, give the plain reason. (Persona is refined with the research lead.)`;

/** Fill {model}/{maker}/{served}/{training} from the served model identity. */
function fillIdentityTokens(
	template: string,
	id: { short: string; served?: string; maker: string; training?: string }
): string {
	return template
		.replaceAll("{model}", id.short)
		.replaceAll("{maker}", id.maker)
		.replaceAll("{served}", id.served ?? "")
		.replaceAll("{training}", id.training ?? "");
}

/**
 * Build the system persona. `override` (the tuning panel's persona template, same
 * {token} placeholders) replaces the default prose; identity tokens are filled from the
 * real served model, so an editor who uses the tokens keeps the model name correct across
 * model swaps. (The override is free text, so a trusted editor could still write a wrong
 * name — the tokens prevent accidental staleness, not deliberate misstatement.)
 */
// The {serving} sentence — DERIVED from the live serving authority (resolveServing →
// providerLabel/isSovereign), never hardcoded, so the system prompt can't contradict the
// provenance badge when the serving host flips (HF prototype → CSCS sovereign). The per-answer
// badge stays the reactive authority for exactly who served a turn; with no serving facts (tuning
// preview / tests) this stays provider-agnostic rather than naming a host that may be stale.
// This is calque dual-path fix C — the same fact the badge derives, derived here too.
export function servingClause(serving?: { providerLabel: string; isSovereign: boolean }): string {
	if (serving?.isSovereign) {
		return `This alpha runs on sovereign public compute (${serving.providerLabel}) — CSCS in Switzerland, with LUMI in Finland as a further production target. If asked where you run, say this honestly.`;
	}
	const via = serving?.providerLabel
		? `${serving.providerLabel} (an open inference provider)`
		: "an open inference provider";
	return `This alpha is served through ${via}; the production stack runs on sovereign public compute (CSCS in Switzerland, LUMI in Finland). If asked where you run, say this honestly and do not name a specific datacenter as currently serving this request.`;
}

export function buildPersonaPrompt(
	modelId?: string,
	override?: string,
	opts?: { grounded?: boolean; serving?: { providerLabel: string; isSovereign: boolean } }
): string {
	const identity = resolveModelIdentity(modelId);
	let template = override?.trim() ? override : DEFAULT_PERSONA_TEMPLATE;
	// Grounded turn: the search-grounding suffix is the authority on recency, so drop the persona's
	// recency hedge to remove the contradiction the 8B otherwise resolves the wrong way (disclaiming
	// real-time access while fresh sources sit unused). Exact-constant match keeps this in sync with
	// the default template; an override that doesn't contain the clause is simply left untouched.
	if (opts?.grounded) {
		template = template
			.replace(RECENCY_CLAUSE, "")
			.replace(/\n{3,}/g, "\n\n")
			.trim();
	}
	// {serving} is filled from the serving authority; an override without the token is left as-is.
	return fillIdentityTokens(template, identity).replaceAll(
		"{serving}",
		servingClause(opts?.serving)
	);
}

/** Decoding params with an optional tuning override merged over the code defaults. */
export function resolveDecoding(
	override?: Partial<typeof GROUNDED_DECODING>
): typeof GROUNDED_DECODING {
	return { ...GROUNDED_DECODING, ...(override ?? {}) };
}
