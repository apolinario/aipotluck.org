import type { InferenceProvider } from "@huggingface/inference";

export type MessageUpdate =
	| MessageStatusUpdate
	| MessageTitleUpdate
	| MessageStreamUpdate
	| MessageFileUpdate
	| MessageFinalAnswerUpdate
	| MessageReasoningUpdate
	| MessageRouterMetadataUpdate
	| MessageSafetyUpdate;

export enum MessageUpdateType {
	Status = "status",
	Title = "title",
	Stream = "stream",
	File = "file",
	FinalAnswer = "finalAnswer",
	Reasoning = "reasoning",
	RouterMetadata = "routerMetadata",
	Safety = "safety",
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
