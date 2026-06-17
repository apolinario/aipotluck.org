import { preprocessMessages } from "../endpoints/preprocessMessages";

import { generateTitleForConversation } from "./title";
import { injectArtifactsPrompt } from "./artifacts";
import { injectSearchGroundingPrompt } from "./searchGrounding";
import {
	type MessageUpdate,
	MessageUpdateType,
	MessageUpdateStatus,
} from "$lib/types/MessageUpdate";
import { generate } from "./generate";
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

	// Artifacts are opt-in per model (supportsArtifacts in the MODELS overrides),
	// with a per-model user override from the model settings page
	let preprompt =
		(ctx.artifactsOverride ?? ctx.model.supportsArtifacts)
			? injectArtifactsPrompt(conv.preprompt)
			: conv.preprompt;

	// When the user grounded this turn on an open-web search, append the numbered
	// evidence + cite-only instructions LAST so it's the highest-salience guidance.
	if (ctx.searchContext?.evidence) {
		preprompt = injectSearchGroundingPrompt(
			preprompt,
			ctx.searchContext.evidence,
			ctx.searchContext.asOf
		);
	}

	const processedMessages = await preprocessMessages(messages, convId);

	// Tool/MCP flow removed (B1-lite strip) — go straight to default text generation.
	yield* generate({ ...ctx, messages: processedMessages }, preprompt);

	done.abort();
}
