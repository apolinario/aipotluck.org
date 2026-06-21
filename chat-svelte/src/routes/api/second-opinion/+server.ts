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
import { getTuning } from "$lib/server/tuning";
import { PANELIST_PREPROMPT, AGGREGATOR_PREPROMPT } from "$lib/server/comparePrompts";
import type { Message } from "$lib/types/Message";

// Collective second opinion (opt-in). The sovereign Apertus primary has ALREADY answered;
// this fans the same question out to a panel of independent open models IN PARALLEL, then
// an aggregator writes a VERDICT ON THE PRIMARY ANSWER — agreement headline + where the
// panel confirms it / challenges it / what they all miss. It deliberately does NOT merge
// the panel into a new answer: the answer already exists, the fanout VERIFIES it. (This is
// the OpenRouter-Fusion pipeline truncated before its synthesis step — we keep the honest
// "analysis" stage and drop the synthesis, because our product is legibility, not a
// polished consensus.) Cross-model agreement is the only honest per-answer confidence
// signal, so the verdict reports it; it never asserts ground truth.
//
// PERSISTED onto the target message (message.opinions[] + message.verdict), so it survives
// reload. Best-effort and fail-soft: dead panelists are skipped; total failure returns
// { available: false } so the UI falls back honestly rather than hang or fabricate.

// PANELIST_PREPROMPT + AGGREGATOR_PREPROMPT live in $lib/server/comparePrompts so the
// /tuning panel can expose them as editable defaults; the handler reads any override via
// getTuning() and falls back to these constants.

const PANEL_TIMEOUT_MS = 30_000;
const AGG_TIMEOUT_MS = 40_000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
	let t: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, rej) => {
		t = setTimeout(() => rej(new Error("compare timeout")), ms);
	});
	try {
		return await Promise.race([p, timeout]);
	} finally {
		clearTimeout(t!);
	}
}

// Thinking models (GLM, Qwen) emit a <think>…</think> block before the answer; strip it.
function stripThink(t: string): string {
	return t.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function runOne(
	modelId: string,
	content: string,
	preprompt: string,
	maxTokens: number,
	timeoutMs: number,
	locals: App.Locals
): Promise<string | null> {
	try {
		const raw = await withTimeout(
			getReturnFromGenerator(
				generateFromDefaultEndpoint({
					messages: [{ from: "user", content }],
					preprompt,
					generateSettings: { max_tokens: maxTokens, temperature: 0 },
					modelId,
					locals,
				})
			),
			timeoutMs
		);
		const out = stripThink(String(raw ?? ""));
		return out || null;
	} catch (e) {
		logger.warn({ err: String(e), model: modelId }, "[compare] panelist failed (skipped)");
		return null;
	}
}

type Verdict = NonNullable<Message["verdict"]>;

function asStringList(v: unknown): string[] {
	if (!Array.isArray(v)) return [];
	return v
		.map((x) => String(x).trim())
		.filter(Boolean)
		.slice(0, 8);
}

// Robustly extract the verdict JSON from the aggregator's output. Falls back to a neutral
// verdict (never fabricates agreement) when parsing fails.
function parseVerdict(raw: string | null, n: number, hasPrimary: boolean): Verdict {
	const plural = n === 1 ? "" : "s";
	const fallback: Verdict = {
		agreement: "mixed",
		// Honest in BOTH cases: only claim "compared this answer" when a primary answer
		// actually existed to compare against (see the aggInput branch). With no primary,
		// the panel only weighed in among itself — don't assert a comparison that didn't run.
		headline: hasPrimary
			? `Compared this answer against ${n} independent open model${plural} — see their takes below.`
			: `${n} independent open model${plural} weighed in on this question — see their takes below.`,
		consensus: [],
		contradictions: [],
		blindSpots: [],
	};
	if (!raw) return fallback;
	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start === -1 || end <= start) return fallback;
	try {
		const obj = JSON.parse(raw.slice(start, end + 1));
		const agreement = obj.agreement === "high" || obj.agreement === "low" ? obj.agreement : "mixed";
		const headline =
			typeof obj.headline === "string" && obj.headline.trim()
				? obj.headline.trim()
				: fallback.headline;
		return {
			agreement,
			headline,
			consensus: asStringList(obj.consensus),
			contradictions: asStringList(obj.contradictions),
			blindSpots: asStringList(obj.blindSpots),
		};
	} catch {
		return fallback;
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAuth(locals);

	// The panel = COMPARE_PANEL (comma-separated) when set, else the [SECOND, THIRD] pair.
	const panelRaw = ((Reflect.get(config, "COMPARE_PANEL") as string | undefined) ?? "").trim();
	const panelIds = (
		panelRaw
			? panelRaw.split(",").map((s) => s.trim())
			: [
					((Reflect.get(config, "SECOND_OPINION_MODEL") as string | undefined) ?? "").trim(),
					((Reflect.get(config, "THIRD_OPINION_MODEL") as string | undefined) ?? "").trim(),
				]
	)
		.filter(Boolean)
		// Only ids actually registered as endpoints (a bad id is skipped, not fatal).
		.filter((id) => models.some((m) => m.id === id));
	if (!panelIds.length) {
		return json(
			{ available: false, reason: "not_configured" },
			{ headers: { "cache-control": "no-store" } }
		);
	}
	const aggId =
		((Reflect.get(config, "AGGREGATOR_MODEL") as string | undefined) ?? "").trim() || panelIds[0];

	let body: { question?: string; conversationId?: string; messageId?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, "invalid JSON body");
	}
	const conversationId = (body.conversationId ?? "").trim();
	const messageId = (body.messageId ?? "").trim();

	// Prefer the real turn from the conversation record: the question (parent user message)
	// and the PRIMARY answer (the target assistant message) the panel is verifying.
	let conversation: Awaited<ReturnType<typeof resolveConversation>> | undefined;
	let targetMessage: Message | undefined;
	let primaryAnswer = "";
	if (conversationId) {
		try {
			conversation = await resolveConversation(conversationId, locals);
			targetMessage = conversation.messages.find((m) => m.id === messageId);
			primaryAnswer = (targetMessage?.content ?? "").trim();
			const parent = conversation.messages.find((m) => m.children?.includes(messageId));
			if (parent?.from === "user" && parent.content?.trim()) {
				body.question = parent.content.trim();
			}
		} catch {
			conversation = undefined;
		}
	}

	const question = (body.question ?? "").trim();
	if (!question) throw error(400, "missing question");
	if (question.length > 4000) throw error(400, "question too long");

	// Live-tunable prompts (admin /tuning panel) with the shared constants as fallback.
	const tuning = await getTuning();
	const panelistPrompt = tuning.panelistPrompt || PANELIST_PREPROMPT;
	const aggregatorPrompt = tuning.aggregatorPrompt || AGGREGATOR_PREPROMPT;

	try {
		// Fan out to the whole panel in PARALLEL. Latency ≈ the slowest model, not the sum.
		const settled = await Promise.all(
			panelIds.map(async (id) => {
				const answer = await runOne(id, question, panelistPrompt, 2048, PANEL_TIMEOUT_MS, locals);
				if (!answer) return null;
				const identity = resolveModelIdentity(id);
				const model = models.find((m) => m.id === id);
				return {
					model: id,
					modelShort: model?.displayName || identity.short,
					openness: identity.openness,
					sovereign: false, // panel rides the non-sovereign compare endpoint; say so
					answer,
				};
			})
		);
		const opinions = settled.filter((o): o is NonNullable<typeof o> => o !== null);
		if (!opinions.length) {
			return json(
				{ available: false, reason: "empty" },
				{ headers: { "cache-control": "no-store" } }
			);
		}

		// Aggregate into a verdict ON the primary answer — analyse, do not synthesise.
		const panelBlock = opinions
			.map((o, i) => `${i + 1}. [${o.modelShort}]: ${o.answer}`)
			.join("\n\n");
		const aggInput =
			`QUESTION:\n${question}\n\n` +
			(primaryAnswer
				? `ANSWER GIVEN (by the primary model, the one being audited):\n${primaryAnswer}\n\n`
				: `(No primary answer available — report where the PANEL agrees and disagrees among itself.)\n\n`) +
			`PANEL TAKES (${opinions.length} independent open models):\n${panelBlock}`;
		const aggRaw = await runOne(aggId, aggInput, aggregatorPrompt, 1024, AGG_TIMEOUT_MS, locals);
		const verdict = parseVerdict(aggRaw, opinions.length, Boolean(primaryAnswer));

		// Persist opinions[] + verdict onto the target message (best-effort).
		if (conversation && targetMessage) {
			try {
				const updatedMessages = conversation.messages.map((m) =>
					m.id === messageId ? { ...m, opinions, verdict } : m
				);
				await collections.conversations.updateOne(
					{ _id: new ObjectId(conversation._id), ...authCondition(locals) },
					{ $set: { messages: updatedMessages } }
				);
			} catch (e) {
				logger.error(e, "[compare] persist failed (returning unpersisted)");
			}
		}

		return json(
			{ available: true, opinions, verdict },
			{ headers: { "cache-control": "no-store" } }
		);
	} catch (e) {
		logger.error(e, "[compare] fanout failed");
		return json(
			{ available: false, reason: "error" },
			{ headers: { "cache-control": "no-store" } }
		);
	}
};
