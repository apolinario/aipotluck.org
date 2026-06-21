import {
	MessageUpdateStatus,
	MessageUpdateType,
	MessageReasoningUpdateType,
	type MessageUpdate,
	type MessageStreamUpdate,
} from "$lib/types/MessageUpdate";
import type { Message } from "$lib/types/Message";
import type { Metrics } from "$lib/server/metrics";

/**
 * The per-turn event reducer, lifted out of the conversation POST handler's stream `start()` closure.
 *
 * `applyMessageUpdate` is the 10-way dispatch on `event.type` that folds each streamed
 * MessageUpdate into the assistant message (`content`, `reasoning`, `files`, `routerMetadata`,
 * the audit `updates[]` log) and records model metrics. It is deliberately free of the stream
 * controller, the DB handle, and `conv`: the handler keeps the enqueue/detach/persist plumbing,
 * passes in the title-persist callback, and shares the mutable counters via {@link StreamState}.
 * That split is what makes the reducer unit-testable (see streamUpdate.spec.ts) — the part of the
 * old closure that carried nearly all the branching now has direct tests.
 *
 * Returns the event to enqueue to the client: identical to the input except Stream events, whose
 * token is null-padded to a fixed width (a side-channel defense, see below). Returns `null` for an
 * empty-token Stream event — the handler drops it entirely (no enqueue, no audit, no persist),
 * matching the original closure's early `return`.
 */

/** Per-generation mutable counters + flags shared between the reducer and the handler's stream loop. */
export interface StreamState {
	/** A FinalAnswer event has set the message's final text. The handler skips the interrupted-final fallback once true. */
	finalAnswerReceived: boolean;
	/** A Status:Finished event has been emitted, so the handler must not emit a second one. */
	finishedStatusSent: boolean;
	/** First content token seen — gates the one-shot time-to-first-token metric. */
	firstTokenObserved: boolean;
	/** Timestamp of the last content token, for the inter-token latency metric. */
	lastTokenTimestamp: Date | undefined;
}

export function createStreamState(): StreamState {
	return {
		finalAnswerReceived: false,
		finishedStatusSent: false,
		firstTokenObserved: false,
		lastTokenTimestamp: undefined,
	};
}

/** Metric handles + their fixed inputs, or undefined when the metrics server is off. */
export interface MetricsContext {
	model: Metrics["model"];
	labels: { model: string };
	promptedAt: Date;
}

export interface ApplyUpdateContext {
	/** The assistant message being streamed into (messageToWriteTo). Mutated in place. */
	message: Message;
	/** The message content before this turn streamed — the splice point for FinalAnswer. */
	initialMessageContent: string;
	/** Only `isRouter` is read, to decide how RouterMetadata is merged. */
	model: { isRouter?: boolean };
	/** Shared mutable counters/flags (also read by the handler after the loop). */
	state: StreamState;
	/** Present only when the metrics server is enabled. */
	metrics?: MetricsContext;
	/** Persist a freshly-sanitized conversation title (the reducer stays free of the DB handle and `conv`). */
	saveTitle: (sanitizedTitle: string) => Promise<void>;
}

export async function applyMessageUpdate(
	event: MessageUpdate,
	ctx: ApplyUpdateContext
): Promise<MessageUpdate | null> {
	const { message, initialMessageContent, model, state, metrics } = ctx;

	if (event.type === MessageUpdateType.Status && event.status === MessageUpdateStatus.Finished) {
		state.finishedStatusSent = true;
	}

	// Add token to content or skip if empty
	if (event.type === MessageUpdateType.Stream) {
		if (event.token === "") return null;
		message.content += event.token;

		if (metrics) {
			const now = Date.now();
			metrics.model.tokenCountTotal.inc(metrics.labels);

			if (!state.firstTokenObserved) {
				metrics.model.timeToFirstToken.observe(metrics.labels, now - metrics.promptedAt.getTime());
				state.firstTokenObserved = true;
			}

			const previousTimestamp = state.lastTokenTimestamp
				? state.lastTokenTimestamp.getTime()
				: metrics.promptedAt.getTime();
			metrics.model.timePerOutputToken.observe(metrics.labels, now - previousTimestamp);
		}

		state.lastTokenTimestamp = new Date();
	}

	// Append reasoning stream tokens to message.reasoning (server-side)
	else if (
		event.type === MessageUpdateType.Reasoning &&
		event.subtype === MessageReasoningUpdateType.Stream &&
		"token" in event
	) {
		message.reasoning ??= "";
		message.reasoning += event.token;
	}

	// Set the title
	else if (event.type === MessageUpdateType.Title) {
		// Always strip <think> markers from titles when saving
		const sanitizedTitle = event.title.replace(/<\/?think>/gi, "").trim();
		await ctx.saveTitle(sanitizedTitle);
	}

	// Set the final text and the interrupted flag. Tools/MCP were removed in the B1-lite strip, so the
	// provider's final text simply replaces the streamed-so-far text (the old pre-tool merge is gone).
	else if (event.type === MessageUpdateType.FinalAnswer) {
		message.interrupted = event.interrupted;
		message.content = initialMessageContent + event.text;
		state.finalAnswerReceived = true;

		if (metrics) {
			metrics.model.latency.observe(metrics.labels, Date.now() - metrics.promptedAt.getTime());
		}
	}

	// Add file
	else if (event.type === MessageUpdateType.File) {
		message.files = [
			...(message.files ?? []),
			{ type: "hash", name: event.name, value: event.sha, mime: event.mime },
		];
	}

	// Store router metadata (for router models) or provider info (for all models)
	else if (event.type === MessageUpdateType.RouterMetadata) {
		// Merge metadata updates to preserve existing fields (router may send route/model first, then provider comes later)
		if (model.isRouter) {
			message.routerMetadata = {
				route: event.route || message.routerMetadata?.route || "",
				model: event.model || message.routerMetadata?.model || "",
				provider: event.provider || message.routerMetadata?.provider,
			};
		}
		// Store provider-only metadata for non-router models if available
		else if (event.provider) {
			message.routerMetadata = {
				route: message.routerMetadata?.route || "",
				model: message.routerMetadata?.model || "",
				provider: event.provider,
			};
		}
	}

	// Append updates for audit/replay (streams too, to preserve ordering). AgentStep is a
	// transient live-stack animation beat (the step history persists in the <think> block and
	// the verified answer), so it streams to the client but is NOT written to the audit log.
	if (
		!(event.type === MessageUpdateType.Status && event.status === MessageUpdateStatus.KeepAlive) &&
		event.type !== MessageUpdateType.AgentStep
	) {
		message.updates?.push(event.type === MessageUpdateType.Stream ? { ...event } : event);
	}

	// Avoid remote keylogging attack executed by watching packet lengths
	// by padding the text with null chars to a fixed length
	// https://cdn.arstechnica.net/wp-content/uploads/2024/03/LLM-Side-Channel.pdf
	let outgoing: MessageUpdate = event;
	if (event.type === MessageUpdateType.Stream) {
		outgoing = { ...event, token: event.token.padEnd(16, "\0") } satisfies MessageStreamUpdate;
	}

	message.updatedAt = new Date();
	return outgoing;
}
