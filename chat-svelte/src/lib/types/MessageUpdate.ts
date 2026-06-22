import type { InferenceProvider } from "@huggingface/inference";
import type { RagSource } from "./Rag";

export type MessageUpdate =
	| MessageStatusUpdate
	| MessageTitleUpdate
	| MessageStreamUpdate
	| MessageFileUpdate
	| MessageFinalAnswerUpdate
	| MessageReasoningUpdate
	| MessageRouterMetadataUpdate
	| MessageAgentStepUpdate
	| MessageSafetyUpdate
	| MessageNameNoticeUpdate
	| MessageRagUpdate;

export enum MessageUpdateType {
	Status = "status",
	Title = "title",
	Stream = "stream",
	File = "file",
	FinalAnswer = "finalAnswer",
	Reasoning = "reasoning",
	RouterMetadata = "routerMetadata",
	AgentStep = "agentStep",
	Safety = "safety",
	NameNotice = "nameNotice",
	Rag = "rag",
}

// Status
export enum MessageUpdateStatus {
	Started = "started",
	Error = "error",
	Finished = "finished",
	KeepAlive = "keepAlive",
}
export interface MessageStatusUpdate {
	type: MessageUpdateType.Status;
	status: MessageUpdateStatus;
	message?: string;
	statusCode?: number;
}

// Everything else
export interface MessageTitleUpdate {
	type: MessageUpdateType.Title;
	title: string;
}
export interface MessageStreamUpdate {
	type: MessageUpdateType.Stream;
	token: string;
	/** Length of the original token. Used for compressed/persisted stream markers where token is empty. */
	len?: number;
}

export enum MessageReasoningUpdateType {
	Stream = "stream",
	Status = "status",
}

export type MessageReasoningUpdate = MessageReasoningStreamUpdate | MessageReasoningStatusUpdate;

export interface MessageReasoningStreamUpdate {
	type: MessageUpdateType.Reasoning;
	subtype: MessageReasoningUpdateType.Stream;
	token: string;
}
export interface MessageReasoningStatusUpdate {
	type: MessageUpdateType.Reasoning;
	subtype: MessageReasoningUpdateType.Status;
	status: string;
}

export interface MessageFileUpdate {
	type: MessageUpdateType.File;
	name: string;
	sha: string;
	mime: string;
}
export interface MessageFinalAnswerUpdate {
	type: MessageUpdateType.FinalAnswer;
	text: string;
	interrupted: boolean;
}
export interface MessageRouterMetadataUpdate {
	type: MessageUpdateType.RouterMetadata;
	route: string;
	model: string;
	provider?: InferenceProvider;
}

// Emitted mid-stream by the agent endpoint (Story B) once per execution step, so the live-stack map can
// beat the Hermes agent node as the agent works. Animation-only: the per-step text already streams in the
// <think> block and the verified answer persists, so this is NOT stamped onto a message field or persisted —
// the client turns it into an `ap:flash` beat on the `hermes` node and the server drops it from the audit log.
export interface MessageAgentStepUpdate {
	type: MessageUpdateType.AgentStep;
	index: number; // 0-based step index
	tool: string; // the step's tool/action name (already redacted by the agent service)
	total?: number; // total planned steps, when known (from the plan event)
}

// Emitted when the proactive safety pre-screen (toxic-bert / child-safety) declines a
// message BEFORE the model runs. Carries the marker the client stamps onto
// message.moderation so the answer renders as a safety decline (not a model answer) and
// the live-stack map highlights the toxic-bert node. Mirrors the prod app's `data-safety`.
export type ModerationKind = "toxicity" | "child_safety";
export interface MessageSafetyUpdate {
	type: MessageUpdateType.Safety;
	kind: ModerationKind;
	label: string | null;
	score: number;
}

// Name-adoption correction. Emitted AFTER generation when the runtime guard ($lib/server/nameGuard)
// detects the model adopted a personal name for itself this turn (prompt rules don't reliably stop
// it). Carries the marker the client stamps onto message.nameNotice so an honest "this system has no
// name" chip renders beside the answer, and so the strip can neutralize the name in later context.
export interface MessageNameNoticeUpdate {
	type: MessageUpdateType.NameNotice;
	/** the adopted nickname, when identifiable (for the chip copy) */
	name?: string;
}

// Emitted when the auto-router retrieved RAG context for this turn (catalog, federated
// EPFL, and/or vault synthesis). Carries the provenance the client stamps onto
// message.rag so the trace + map highlight appear during streaming, not only after reload.
export interface MessageRagUpdate {
	type: MessageUpdateType.Rag;
	query: string;
	sources: RagSource[];
	asOf: string;
	vaultSynthesis?: string;
}
