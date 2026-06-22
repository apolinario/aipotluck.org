import { preprocessMessages } from "../endpoints/preprocessMessages";

import { generateTitleForConversation } from "./title";
import { injectArtifactsPrompt } from "./artifacts";
import { injectSearchGroundingPrompt } from "./searchGrounding";
import { buildPersonaPrompt } from "./persona";
import { hardenLastUserTurn } from "./grounding";
import { maybeWorldModelNote, injectWorldModelNote } from "./worldModel";
import { config } from "$lib/server/config";
import { resolveServing } from "$lib/servingProvenance";
import {
	type MessageUpdate,
	MessageUpdateType,
	MessageUpdateStatus,
} from "$lib/types/MessageUpdate";
import { generate } from "./generate";
import { getTuning } from "../tuning";
import { maybeRunMcpTool, injectMcpResult } from "../mcp";
import { injectRagGrounding } from "./ragGrounding";
import { mergeAsyncGenerators } from "$lib/utils/mergeAsyncGenerators";
import type { TextGenerationContext } from "./types";

async function* keepAlive(done: AbortSignal): AsyncGenerator<MessageUpdate, undefined, undefined> {
	while (!done.aborted) {
		yield {
			type: MessageUpdateType.Status,
			status: MessageUpdateStatus.KeepAlive,
		};
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

export async function* textGeneration(ctx: TextGenerationContext) {
	const done = new AbortController();

	const titleGen = generateTitleForConversation(ctx.conv, ctx.locals);
	const textGen = textGenerationWithoutTitle(ctx, done);
	const keepAliveGen = keepAlive(done.signal);

	// keep alive until textGen is done

	yield* mergeAsyncGenerators([titleGen, textGen, keepAliveGen]);
}

async function* textGenerationWithoutTitle(
	ctx: TextGenerationContext,
	done: AbortController
): AsyncGenerator<MessageUpdate, undefined, undefined> {
	yield {
		type: MessageUpdateType.Status,
		status: MessageUpdateStatus.Started,
	};

	const { conv, messages } = ctx;
	const convId = conv._id;

	// The last user turn drives the server-side grounding pre-passes (RAG, MCP, world-model).
	const lastUserText = messages
		.filter((m) => m.from === "user")
		.map((m) => m.content ?? "")
		.at(-1);

	// TEMP (pre-launch tuning panel): one cached read of the operator overrides for this
	// turn — persona / grounding / decoding. Empty (→ code defaults) unless an editor has
	// set them via /tuning. See $lib/server/tuning.
	const tuning = await getTuning();

	const rag = ctx.ragContext ?? null;

	// The honest Calm-AI persona is the FOUNDATION of every system prompt — identity
	// derived from the served model id, closed-as-open guardrail, recency hedging,
	// non-anthropomorphic voice. Any conv/model-configured preprompt is appended
	// after it. Without this the fork regressed to rambling, confabulating answers.
	// A turn grounded on a fresh open-web search must NOT carry the persona's recency hedge — it
	// contradicts the grounding ("the sources ARE current") and the 8B follows the hedge, disclaiming
	// real-time access while the retrieved sources go unused. Drop the hedge when grounded.
	const grounded = !!(ctx.searchContext?.evidence || rag?.evidence || rag?.vaultSynthesis);
	// Serving facts from the ONE authority (resolveServing) so the system prompt's serving claim
	// can't drift from the provenance badge when the host flips (HF prototype → CSCS sovereign).
	const serving = resolveServing(config.OPENAI_BASE_URL, ctx.model.id ?? ctx.model.name);
	const persona = buildPersonaPrompt(ctx.model.id ?? ctx.model.name, tuning.persona, {
		grounded,
		serving,
	});
	const basePreprompt = conv.preprompt?.trim() ? `${persona}\n\n${conv.preprompt}` : persona;

	// Artifacts are opt-in per model (supportsArtifacts in the MODELS overrides),
	// with a per-model user override from the model settings page
	let preprompt =
		(ctx.artifactsOverride ?? ctx.model.supportsArtifacts)
			? injectArtifactsPrompt(basePreprompt)
			: basePreprompt;

	// When the user grounded this turn on an open-web search, append the numbered
	// evidence + cite-only instructions LAST so it's the highest-salience guidance.
	if (ctx.searchContext?.evidence) {
		preprompt = injectSearchGroundingPrompt(
			preprompt,
			ctx.searchContext.evidence,
			ctx.searchContext.asOf,
			tuning.grounding
		);
	}

	// RAG grounding from the auto-router (computed above) goes in the same high-salience slot
	// as search grounding: numbered catalog/EPFL sources to cite + the vault synthesis to attribute.
	if (rag) {
		preprompt = injectRagGrounding(preprompt, rag);
	}

	// MCP tool (an open HF Space) — INERT unless SPACE_MCP_URL is configured. A bare-prompt
	// router decides + extracts (the persona suppresses in-context tool-choice by design); the
	// result is injected as grounding for the passive persona to answer from. Fail-open:
	// maybeRunMcpTool never throws, so a Space being down never blocks the answer.
	if (lastUserText) {
		const mcp = await maybeRunMcpTool(lastUserText);
		if (mcp) preprompt = injectMcpResult(preprompt, mcp);
	}

	// World-model pre-pass (heuristic-override mitigation) — INERT unless
	// WORLD_MODEL_PREPASS=true. On an implicit-world-model turn ("the car wash is
	// 100m away, walk or drive?") a neutral 2-fact extraction feeds a deterministic
	// gate; when it fires we inject a world-state note so the model phrases the
	// physically-correct answer instead of the surface "it's close, just walk".
	// Fail-open: maybeWorldModelNote never throws, so it can't block the answer.
	if (lastUserText) {
		const note = await maybeWorldModelNote(lastUserText, ctx.locals);
		if (note) preprompt = injectWorldModelNote(preprompt, note);
	}

	const processedMessages = await preprocessMessages(messages, convId);

	// Ground the last user turn to a real catalog category and wrap it in an
	// unguessable fence: the brevity + identity-lock + injection guard live in the
	// USER role because Apertus under-weights the system role. Mutates in place.
	hardenLastUserTurn(processedMessages, serving);

	// Tool/MCP flow removed (B1-lite strip) — go straight to default text generation.
	// tuning.decoding (if set via the panel) is merged over GROUNDED_DECODING in generate.
	yield* generate({ ...ctx, messages: processedMessages }, preprompt, tuning.decoding);

	done.abort();
}
