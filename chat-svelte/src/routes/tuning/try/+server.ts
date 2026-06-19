// TEMP: pre-launch tuning panel — run a query against the editor's UNSAVED draft persona
// so Laura can iterate wording without saving-to-prod and tab-switching to the chat. One
// non-streaming model call; returns the answer AND the assembled system prompt. Admin-gated.
// Remove with routes/tuning/.
import { json, error } from "@sveltejs/kit";
import { z } from "zod";
import { requireAdmin } from "$lib/server/api/utils/requireAuth";
import { config } from "$lib/server/config";
import { defaultModel } from "$lib/server/models";
import { buildPersonaPrompt, resolveDecoding } from "$lib/server/textGeneration/persona";
import type { RequestHandler } from "./$types";

const TryBody = z.object({
	query: z.string().min(1).max(4000),
	// The draft persona from the editor's textarea (blank → the built-in default is tested).
	persona: z.string().max(20000).optional(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);

	const parsed = TryBody.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, "query is required");
	const { query, persona } = parsed.data;

	const model = defaultModel?.id ?? defaultModel?.name ?? "";
	// Same identity-token fill as the live chat, so the test reflects what users would see.
	const system = buildPersonaPrompt(model, persona);
	const dec = resolveDecoding(); // v1: default decoding (persona is what's being tuned)

	try {
		const { OpenAI } = await import("openai");
		const client = new OpenAI({
			baseURL: config.OPENAI_BASE_URL,
			apiKey: config.OPENAI_API_KEY || config.HF_TOKEN || "sk-",
			defaultHeaders: { "User-Agent": "aipotluck-chat" },
		});
		const res = await client.chat.completions.create({
			model,
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: query },
			],
			temperature: dec.temperature,
			frequency_penalty: dec.frequency_penalty,
			presence_penalty: dec.presence_penalty,
			max_tokens: dec.max_tokens,
			stream: false,
		});
		return json({ answer: res.choices?.[0]?.message?.content ?? "", system });
	} catch (e) {
		throw error(502, e instanceof Error ? e.message : "model call failed");
	}
};
