import { preprocessMessages } from "../endpoints/preprocessMessages";

import { generateTitleForConversation } from "./title";
import { injectArtifactsPrompt } from "./artifacts";
import { injectSearchGroundingPrompt } from "./searchGrounding";
import { buildPersonaPrompt } from "./persona";
import { hardenLastUserTurn } from "./grounding";
import {
	type MessageUpdate,
	MessageUpdateType,
	MessageUpdateStatus,
} from "$lib/types/MessageUpdate";
import { generate } from "./generate";
import { getTuning } from "../tuning";
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

	// TEMP (pre-launch tuning panel): one cached read of the operator overrides for this
	// turn — persona / grounding / decoding. Empty (→ code defaults) unless an editor has
	// set them via /tuning. See $lib/server/tuning.
	const tuning = await getTuning();

	// The honest Calm-AI persona is the FOUNDATION of every system prompt — identity
	// derived from the served model id, closed-as-open guardrail, recency hedging,
	// non-anthropomorphic voice. Any conv/model-configured preprompt is appended
	// after it. Without this the fork regressed to rambling, confabulating answers.
	const persona = buildPersonaPrompt(ctx.model.id ?? ctx.model.name, tuning.persona);
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

	const processedMessages = await preprocessMessages(messages, convId);

	// Ground the last user turn to a real catalog category and wrap it in an
	// unguessable fence: the brevity + identity-lock + injection guard live in the
	// USER role because Apertus under-weights the system role. Mutates in place.
	hardenLastUserTurn(processedMessages);

	// Tool/MCP flow removed (B1-lite strip) — go straight to default text generation.
	// tuning.decoding (if set via the panel) is merged over GROUNDED_DECODING in generate.
	yield* generate({ ...ctx, messages: processedMessages }, preprompt, tuning.decoding);

	done.abort();
}
