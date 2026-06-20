import { json, error, type RequestHandler } from "@sveltejs/kit";
import { requireAuth } from "$lib/server/api/utils/requireAuth";
import { config } from "$lib/server/config";
import { models } from "$lib/server/models";
import { resolveModelIdentity } from "$lib/identity";
import { generateFromDefaultEndpoint } from "$lib/server/generateFromDefaultEndpoint";
import { getReturnFromGenerator } from "$lib/utils/getReturnFromGenerator";
import { logger } from "$lib/server/logger";

// Opt-in "second opinion" from a more-capable open model on a DIFFERENT provider.
// The honest spine of the escalation UX: the sovereign Apertus primary answers
// first; the user may ask a more-capable open-weights model (e.g. GLM-5.2 on the
// HF router) for an independent take. We surface only REAL signals — the second
// model's own answer and (client-side) whether it disagrees — never a faked
// confidence verdict. Provenance is honest: which model, which provider, and that
// it is open-but-not-sovereign.
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

	let body: { question?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, "invalid JSON body");
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
		return json(
			{
				available: true,
				answer,
				modelId,
				// Prefer the configured display name (SECOND_OPINION_DISPLAY_NAME) when set,
				// else the honest generic identity ("GLM 5.2 FP8").
				modelShort: model.displayName || identity.short,
				openness: identity.openness, // "open weights" — honest; not "fully open" unless it is
				maker: identity.maker,
				// This model is served on a non-sovereign provider (HF router). The
				// sovereign primary is Apertus on CSCS; say so plainly.
				sovereign: false,
			},
			{ headers: { "cache-control": "no-store" } }
		);
	} catch (e) {
		logger.error(e, "[second-opinion] failed");
		return json({ available: false, reason: "error" }, { headers: { "cache-control": "no-store" } });
	}
};
