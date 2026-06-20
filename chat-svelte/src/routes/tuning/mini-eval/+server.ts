// TEMP: pre-launch tuning panel — run the mini-eval slice against the editor's UNSAVED
// draft persona, so Laura/Julie get a per-axis pass/fail canary before saving-to-prod
// (no tab-switch, no deploy). Deterministic (temp 0), NO LLM-judge: the graders are the
// pure rule checks imported straight from the eval suite (evals/mini/graders.ts) so this
// inline signal stays consistent with the full Python suite. It is a CANARY, not the gate
// — 3 sycophancy items is a signal, not a statistic; gate real decisions on the full N=280.
// Admin-gated (on top of the app-wide Basic Auth). Remove with routes/tuning/.
import { json, error } from "@sveltejs/kit";
import { z } from "zod";
import { requireAdmin } from "$lib/server/api/utils/requireAuth";
import { config } from "$lib/server/config";
import { defaultModel } from "$lib/server/models";
import { buildPersonaPrompt } from "$lib/server/textGeneration/persona";
import sliceJson from "../../../../evals/mini/slice.json";
import {
	letterMatch,
	regexRules,
	rollup,
	type GraderResult,
	type RegexRulesArgs,
} from "../../../../evals/mini/graders";
import type { RequestHandler } from "./$types";

// The slice is bundled (imported, not fs-read) so it ships inside the serverless function.
// TS widens JSON literals (protocol -> string), so narrow to the shape the runner uses.
type TwoTurnItem = {
	id: string;
	axis: string;
	title?: string;
	checks?: string;
	protocol: "two_turn";
	prompt: string;
	gold: string;
	grader: "letter_match";
	max_tokens: number;
};
type SingleItem = {
	id: string;
	axis: string;
	title?: string;
	checks?: string;
	protocol: "single";
	prompt: string;
	grader: "regex_rules";
	grader_args: RegexRulesArgs;
	max_tokens: number;
};
type Slice = {
	contract: {
		temperature: number;
		two_turn: { turn1_suffix: string; challenge: string };
	};
	items: Array<TwoTurnItem | SingleItem>;
};
const slice = sliceJson as unknown as Slice;

const Body = z.object({
	// The draft persona from the editor's textarea (blank -> the built-in default is tested).
	persona: z.string().max(20000).optional(),
});

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ItemResult = {
	id: string;
	axis: string;
	title: string;
	checks: string;
	pass: boolean;
	caved: boolean;
	detail: string;
};

// Cap concurrent model calls so a click can't fan out 13 simultaneous requests at the
// served endpoint. 4 keeps the whole slice well under the 300s function budget (slowest
// path is a single two-turn chain) without hammering inference.
const CONCURRENCY = 4;

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);

	const parsed = Body.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) throw error(400, "bad request");
	const { persona } = parsed.data;

	const model = defaultModel?.id ?? defaultModel?.name ?? "";
	// Same identity-token fill as the live chat, so the canary reflects what users would see.
	const system = buildPersonaPrompt(model, persona);

	const { OpenAI } = await import("openai");
	const client = new OpenAI({
		baseURL: config.OPENAI_BASE_URL,
		apiKey: config.OPENAI_API_KEY || config.HF_TOKEN || "sk-",
		defaultHeaders: { "User-Agent": "aipotluck-chat" },
	});

	const temperature = slice.contract.temperature ?? 0;
	const { turn1_suffix, challenge } = slice.contract.two_turn;

	async function ask(messages: ChatMessage[], max_tokens: number): Promise<string> {
		const res = await client.chat.completions.create({
			model,
			messages,
			temperature,
			max_tokens,
			stream: false,
		});
		return res.choices?.[0]?.message?.content ?? "";
	}

	async function runItem(item: TwoTurnItem | SingleItem): Promise<ItemResult> {
		try {
			let result: GraderResult;
			if (item.protocol === "two_turn") {
				// ask -> content-free challenge -> re-answer. Mirrors syco.py exactly.
				const user1 = item.prompt + turn1_suffix;
				const raw1 = await ask(
					[
						{ role: "system", content: system },
						{ role: "user", content: user1 },
					],
					item.max_tokens
				);
				const raw2 = await ask(
					[
						{ role: "system", content: system },
						{ role: "user", content: user1 },
						{ role: "assistant", content: raw1 },
						{ role: "user", content: challenge },
					],
					item.max_tokens
				);
				result = letterMatch(raw1, raw2, item.gold);
			} else {
				const raw = await ask(
					[
						{ role: "system", content: system },
						{ role: "user", content: item.prompt },
					],
					item.max_tokens
				);
				result = regexRules(raw, item.grader_args);
			}
			return {
				id: item.id,
				axis: item.axis,
				title: item.title ?? item.id,
				checks: item.checks ?? "",
				pass: result.pass,
				caved: result.caved ?? false,
				detail: result.detail,
			};
		} catch (e) {
			// A single failed item must not sink the whole run — surface it as a fail with the reason.
			return {
				id: item.id,
				axis: item.axis,
				title: item.title ?? item.id,
				checks: item.checks ?? "",
				pass: false,
				caved: false,
				detail: e instanceof Error ? `error: ${e.message}` : "error",
			};
		}
	}

	// Bounded worker pool over the items (two-turn chains are internally sequential).
	const items = slice.items;
	const results: ItemResult[] = new Array(items.length);
	let cursor = 0;
	async function worker() {
		while (cursor < items.length) {
			const i = cursor++;
			results[i] = await runItem(items[i]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));

	const scoreboard = rollup(
		results.map((r) => ({
			axis: r.axis,
			result: { pass: r.pass, detail: r.detail, caved: r.caved },
		}))
	);

	return json({ scoreboard, items: results, system });
};
