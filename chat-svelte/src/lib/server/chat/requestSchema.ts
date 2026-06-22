import { z } from "zod";
import { SEARCH_ENGINES } from "$lib/types/Search";
import { isMessageId } from "$lib/utils/tree/isMessageId";

/**
 * Schema for the JSON `data` field of a chat POST (multipart form). Validates the prompt, the
 * tree position (parent/retry message id), the client-minted generation id used for idempotency,
 * MCP selection, timezone, and the open-web search grounding the client attached for this turn.
 * Kept beside the route so the contract is testable in isolation from the streaming handler.
 */
export const chatRequestSchema = z.object({
	id: z.string().uuid().refine(isMessageId).optional(), // parent message id to append to for a normal message, or the message id for a retry/continue
	// client-chosen id for this generation run, echoed back by the stop
	// request so a stop point can be matched to the run it belongs to
	generationId: z.string().uuid().optional(),
	inputs: z.optional(
		z
			.string()
			.min(1)
			.transform((s) => s.replace(/\r\n/g, "\n"))
	),
	is_retry: z.optional(z.boolean()),
	selectedMcpServerNames: z.optional(z.array(z.string())),
	selectedMcpServers: z
		.optional(
			z.array(
				z.object({
					name: z.string(),
					url: z.string(),
					headers: z
						.optional(z.array(z.object({ key: z.string(), value: z.string() })))
						.default([]),
				})
			)
		)
		.default([]),
	timezone: z.optional(z.string()),
	// Open-web search grounding the client attached for this turn (composer
	// globe toggle). The client runs /api/search and forwards the result so
	// the citations shown match exactly what grounds the answer. Sizes are
	// capped: this is the user's own turn (no privilege escalation — they
	// could type anything as the prompt anyway), but bound the payload.
	searchContext: z.optional(
		z.object({
			query: z.string().max(400),
			asOf: z.string().max(40),
			evidence: z.string().max(20_000),
			sources: z
				.array(
					z.object({
						n: z.number(),
						title: z.string(),
						url: z.string(),
						snippet: z.string(),
						engine: z.enum(SEARCH_ENGINES),
						asOf: z.string().optional(),
						lang: z.string().optional(),
						imageUrl: z.string().optional(),
					})
				)
				.max(20),
		})
	),
	files: z.optional(
		z.array(
			z.object({
				type: z.literal("base64").or(z.literal("hash")),
				name: z.string(),
				value: z.string(),
				mime: z.string(),
			})
		)
	),
});

export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;
