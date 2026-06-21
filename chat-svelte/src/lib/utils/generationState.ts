import type { Message } from "$lib/types/Message";
import { MessageUpdateStatus, MessageUpdateType } from "$lib/types/MessageUpdate";

export function isAssistantGenerationTerminal(message?: Message): boolean {
	if (!message || message.from !== "assistant") return true;

	if (message.interrupted === true) return true;

	const updates = message.updates ?? [];
	const hasFinalAnswer = updates.some((update) => update.type === MessageUpdateType.FinalAnswer);
	if (hasFinalAnswer) return true;

	return updates.some(
		(update) =>
			update.type === MessageUpdateType.Status &&
			(update.status === MessageUpdateStatus.Error ||
				update.status === MessageUpdateStatus.Finished)
	);
}

// A typed per-message status the UI can key off in one place, instead of inferring from
// scattered booleans. `incomplete` is the honest-degradation state the product cares about: the
// stream ended without a clean finish (user stop, or a generation that died after partial tokens) —
// distinct from `error` (an explicit failure status) so the UI can say "response was interrupted"
// over the partial content rather than letting it look complete. Mirrors the assistant-ui message
// state machine (running | complete | incomplete | error), reimplemented over our update stream.
export type MessageStatus = "running" | "complete" | "incomplete" | "error";

export function deriveMessageStatus(message?: Message): MessageStatus {
	if (!message || message.from !== "assistant") return "complete";
	if (!isAssistantGenerationTerminal(message)) return "running";

	const updates = message.updates ?? [];
	// An explicit error status wins: surface the failure plainly over anything else.
	const hasError = updates.some(
		(update) =>
			update.type === MessageUpdateType.Status && update.status === MessageUpdateStatus.Error
	);
	if (hasError) return "error";

	// Interrupted: the persisted flag (user stop / stuck-generation watchdog) or a final-answer
	// update explicitly flagged interrupted. Partial content is preserved; we render it honestly.
	const interrupted =
		message.interrupted === true ||
		updates.some(
			(update) => update.type === MessageUpdateType.FinalAnswer && update.interrupted === true
		);
	if (interrupted) return "incomplete";

	return "complete";
}

export function isConversationGenerationActive(messages: Message[]): boolean {
	const lastAssistant = [...messages].reverse().find((message) => message.from === "assistant");
	if (!lastAssistant) return false;

	return !isAssistantGenerationTerminal(lastAssistant);
}

/**
 * How long a generation may go without any database write before it is
 * considered dead. Conversation.updatedAt is bumped when a generation starts
 * (the pre-stream message write) and when it ends (persistConversation), so a
 * conversation that has stayed non-terminal longer than this belongs to a pod
 * that crashed before persisting — it will never become terminal on its own
 * and must not keep the UI in a generating state forever.
 */
export const GENERATION_STALE_MS = 10 * 60 * 1000;

export function isGenerationStale(lastWriteAt: Date | string | undefined): boolean {
	if (!lastWriteAt) return false;
	const t = new Date(lastWriteAt).getTime();
	return !Number.isNaN(t) && Date.now() - t > GENERATION_STALE_MS;
}
