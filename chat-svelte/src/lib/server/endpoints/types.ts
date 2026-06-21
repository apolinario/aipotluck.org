import type { Conversation } from "$lib/types/Conversation";
import type { Message } from "$lib/types/Message";
import type {
	TextGenerationStreamOutput,
	TextGenerationStreamToken,
	InferenceProvider,
} from "@huggingface/inference";
import type { Model } from "$lib/types/Model";
import type { ObjectId } from "bson";

// The endpoint type surface lives in this leaf module (no local imports) so the endpoint
// implementations (openai/, agent/) can depend on it without importing the endpoints.ts
// registry — which imports them back. Keeping the types here breaks that import cycle.

export type EndpointMessage = Omit<Message, "id">;

// parameters passed when generating text
export interface EndpointParameters {
	messages: EndpointMessage[];
	preprompt?: Conversation["preprompt"];
	generateSettings?: Partial<Model["parameters"]>;
	isMultimodal?: boolean;
	conversationId?: ObjectId;
	locals: App.Locals | undefined;
	abortSignal?: AbortSignal;
	/** Inference provider preference: "auto", "fastest", "cheapest", or a specific provider name */
	provider?: string;
	/** Optional thinking-effort, forwarded as OpenAI `reasoning_effort` when set */
	reasoningEffort?: "low" | "medium" | "high";
}

export type TextGenerationStreamOutputSimplified = TextGenerationStreamOutput & {
	token: TextGenerationStreamToken;
	routerMetadata?: { route?: string; model?: string; provider?: InferenceProvider };
};

// type signature for the endpoint
export type Endpoint = (
	params: EndpointParameters
) => Promise<AsyncGenerator<TextGenerationStreamOutputSimplified, void, void>>;
