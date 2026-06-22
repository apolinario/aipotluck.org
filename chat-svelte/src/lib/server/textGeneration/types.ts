import type { ProcessedModel } from "../models";
import type { Endpoint } from "../endpoints/endpoints";
import type { Conversation } from "$lib/types/Conversation";
import type { Message } from "$lib/types/Message";
import type { RagContext } from "$lib/types/Rag";

export interface TextGenerationContext {
	model: ProcessedModel;
	endpoint: Endpoint;
	conv: Conversation;
	messages: Message[];
	promptedAt: Date;
	ip: string;
	username?: string;
	/** Force-enable multimodal handling for endpoints that support it */
	forceMultimodal?: boolean;
	/** Inference provider preference: "auto", "fastest", "cheapest", or a specific provider name */
	provider?: string;
	/** Optional thinking-effort override forwarded as `reasoning_effort` to OpenAI-compatible endpoints */
	reasoningEffort?: "low" | "medium" | "high";
	/** Per-model user override for artifacts; wins over the model's supportsArtifacts flag in both directions */
	artifactsOverride?: boolean;
	/** Open-web search grounding for this turn: the numbered evidence block to
	 *  inject into the system prompt, and the date it was retrieved. Set only
	 *  when the user grounded the turn via the composer's web-search toggle. */
	searchContext?: { evidence: string; asOf: string };
	/** RAG retrieval for this turn (computed in +server.ts before textGeneration). */
	ragContext?: RagContext | null;
	locals: App.Locals | undefined;
	abortController: AbortController;
}
