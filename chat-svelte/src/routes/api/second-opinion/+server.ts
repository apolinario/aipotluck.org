import { json, error, type RequestHandler } from "@sveltejs/kit";
import { ObjectId } from "bson";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import { resolveConversation } from "$lib/server/api/utils/resolveConversation";
import { collections } from "$lib/server/database";
import { authCondition } from "$lib/server/auth";
import { config } from "$lib/server/config";
import { models } from "$lib/server/models";
import { resolveModelIdentity } from "$lib/identity";
import { generateFromDefaultEndpoint } from "$lib/server/generateFromDefaultEndpoint";
import { getReturnFromGenerator } from "$lib/utils/getReturnFromGenerator";
import { logger } from "$lib/server/logger";
import type { Message } from "$lib/types/Message";

// Opt-in "second opinion" from a more-capable open model on a DIFFERENT provider.
// The honest spine of the escalation UX: the sovereign Apertus primary answers
// first; the user may ask a more-capable open-weights model (e.g. GLM-5.2 on the
// HF router) for an independent take. We surface only REAL signals — the second
// model's own answer and (client-side) whether it disagrees — never a faked
// confidence verdict. Provenance is honest: which model, which provider, and that
// it is open-but-not-sovereign.
//
// The result is PERSISTED onto the target message (message.secondOpinion), so the
// comparison + the routing map event survive reload, mirroring webSearch/moderation.
//
// Best-effort and fail-soft: any failure (model not configured, provider error,
// timeout) returns { available: false } so the UI can fall back to an honest
// "second opinion unavailable" rather than hang or fabricate.

const SECOND_OPINION_PREPROMPT =
	"You are giving an independent second opinion on a question another assistant " +
	"already answered. Read the question literally — it may differ from a famous " +
	"puzzle or the generic version it resembles, and it may have an implicit catch. " +
	"Reason about what is actually being asked, then give a clear, concise answer.";

const TIMEOUT_MS = 30_000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
	let t: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, rej) => {
		t = setTimeout(() => rej(new Error("second-opinion timeout")), ms);
	});
	try {
		return await Promise.race([p, timeout]);
	} finally {
		clearTimeout(t!);
	}
}

// Thinking models (GLM-5.2) emit a <think>…</think> block before the answer; the
// reasoning is not the answer, so strip it for display.
function stripThink(t: string): string {
	return t.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAuth(locals);

	const modelId = ((Reflect.get(config, "SECOND_OPINION_MODEL") as string | undefined) ?? "").trim();
	const model = modelId ? models.find((m) => m.id === modelId) : undefined;
	if (!model) {
		// Not configured for this deploy — honest "unavailable", not an error.
		return json({ available: false, reason: "not_configured" }, { headers: { "cache-control": "no-store" } });
	}

	let body: { question?: string; conversationId?: string; messageId?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, "invalid JSON body");
	}
	const conversationId = (body.conversationId ?? "").trim();
	const messageId = (body.messageId ?? "").trim();

	// Prefer the question from the conversation record (the prompt the target message
	// actually answered) over client-supplied text — the persisted second opinion is
	// then provably about the real turn. Fall back to the request body.
	let conversation: Awaited<ReturnType<typeof resolveConversation>> | undefined;
	let targetMessage: Message | undefined;
	if (conversationId) {
		try {
			conversation = await resolveConversation(conversationId, locals);
			targetMessage = conversation.messages.find((m) => m.id === messageId);
			const parent = conversation.messages.find((m) => m.children?.includes(messageId));
			if (parent?.from === "user" && parent.content?.trim()) {
				body.question = parent.content.trim();
			}
		} catch {
			// not found / not owned → fall back to body.question, don't persist
			conversation = undefined;
		}
	}

	const question = (body.question ?? "").trim();
	if (!question) throw error(400, "missing question");
	if (question.length > 4000) throw error(400, "question too long");

	const identity = resolveModelIdentity(modelId);

	try {
		const raw = await withTimeout(
			getReturnFromGenerator(
				generateFromDefaultEndpoint({
					messages: [{ from: "user", content: question }],
					preprompt: SECOND_OPINION_PREPROMPT,
					generateSettings: { max_tokens: 2048, temperature: 0 },
					modelId,
					locals,
				})
			),
			TIMEOUT_MS
		);
		const answer = stripThink(String(raw ?? ""));
		if (!answer) {
			return json(
				{ available: false, reason: "empty" },
				{ headers: { "cache-control": "no-store" } }
			);
		}

		const secondOpinion = {
			model: modelId,
			// Prefer the configured display name (SECOND_OPINION_DISPLAY_NAME) when set,
			// else the honest generic identity ("GLM 5.2 FP8").
			modelShort: model.displayName || identity.short,
			openness: identity.openness, // "open weights" — honest; not "fully open" unless it is
			// Served on a non-sovereign provider (HF router); the sovereign primary is
			// Apertus on CSCS. Say so plainly.
			sovereign: false,
			answer,
		};

		// Persist onto the target message so it survives reload (best-effort — a failed
		// write still returns the answer; it just won't survive a refresh).
		if (conversation && targetMessage) {
			try {
				const updatedMessages = conversation.messages.map((m) =>
					m.id === messageId ? { ...m, secondOpinion } : m
				);
				await collections.conversations.updateOne(
					{ _id: new ObjectId(conversation._id), ...authCondition(locals) },
					{ $set: { messages: updatedMessages } }
				);
			} catch (e) {
				logger.error(e, "[second-opinion] persist failed (returning unpersisted)");
			}
		}

		return json({ available: true, ...secondOpinion }, { headers: { "cache-control": "no-store" } });
	} catch (e) {
		logger.error(e, "[second-opinion] failed");
		return json({ available: false, reason: "error" }, { headers: { "cache-control": "no-store" } });
	}
};
