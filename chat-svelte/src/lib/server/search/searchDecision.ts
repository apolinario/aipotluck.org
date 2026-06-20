import { generateFromDefaultEndpoint } from "$lib/server/generateFromDefaultEndpoint";
import { getReturnFromGenerator } from "$lib/utils/getReturnFromGenerator";
import { logger } from "$lib/server/logger";
import { config } from "$lib/server/config";
import { defaultModel } from "$lib/server/models";
import { getTuning } from "$lib/server/tuning";
import { WEB_SEARCH_TOOL } from "./toolSearch";
import {
	CLASSIFIER_PREPROMPT,
	marginFromLogprobs,
	type MarginVerdict,
	type TopLogprob,
} from "./searchMargin";

// Re-export the pure helpers so existing importers (the /tuning page, future call sites) keep
// resolving them from here, while evals/tests import the pure ./searchMargin without the $env graph.
export { CLASSIFIER_PREPROMPT, marginFromLogprobs };
export type { MarginVerdict, TopLogprob };

// Model-driven "does this turn need an open-web search?" classifier. Used by the
// "model" / "tool" trigger strategies (see $lib/search/triggerStrategy) to catch
// current-info questions the recency regex misses. A tiny, cheap, deterministic
// call to the task model — NOT mid-stream tool-calling (the served model's is
// unreliable here today; it should sharpen as the served model improves, but
// degrades gracefully now).

// CLASSIFIER_PREPROMPT moved to ./searchMargin (pure) and re-exported above.

/**
 * Parse the classifier's raw output into a verdict. Anchored on a leading
 * "yes" so partial/rambling output fails closed to "no" (a false-positive
 * search costs latency + injects sources; abstaining just answers from
 * training, same as the no-search path). Exported for unit testing.
 */
export function parseClassifierVerdict(raw: string | undefined): boolean {
	return /^\s*yes\b/i.test((raw ?? "").trim());
}

/**
 * Ask the model whether this query needs open-web grounding. Best-effort:
 * returns false on any error or empty/short query — never throws, never blocks
 * the turn.
 */
export async function classifySearchNeed(
	query: string,
	locals: App.Locals | undefined
): Promise<boolean> {
	const q = query.trim();
	if (q.length < 3) {
		return false;
	}
	try {
		// Live-tunable (admin /tuning panel) with the constant as fallback.
		const preprompt = (await getTuning()).searchClassifierPrompt || CLASSIFIER_PREPROMPT;
		const raw = await getReturnFromGenerator(
			generateFromDefaultEndpoint({
				messages: [{ from: "user", content: `User message: "${q}"` }],
				preprompt,
				generateSettings: { max_tokens: 3, temperature: 0 },
				locals,
			})
		);
		return parseClassifierVerdict(String(raw ?? ""));
	} catch (e) {
		logger.error(e, "search-need classifier failed");
		return false;
	}
}

// ── Model TOOL-CALLING decision (trigger strategy "tool") ───────────────────
// Instead of a yes/no classifier, advertise the web_search tool and let the model
// decide AND author the query. The probe (Apertus 1.5 8B sft-dpo-tools, 2026-06-18)
// confirmed clean OpenAI tool_calls with good discrimination. The chat answer is
// still produced by the existing grounded-streaming path (we run openSearch with
// the model's query and inject evidence) — this call only resolves the decision,
// so the streaming loop is untouched. Search is read-only/benign, so a jailbreak
// in the message can at most force/suppress a search (the heuristic net still
// catches recency); no heavy preprompt hardening needed here.

export type SearchDecision = { shouldSearch: boolean; query?: string };

type ToolCallLike = { function?: { name?: string; arguments?: string } | null } | null;

/**
 * Extract the search decision from a completion's tool_calls. Pure + exported for
 * unit testing against the real response shape. A web_search call → search (with
 * the model's query when parseable); no call → no search. If the model called the
 * tool but the args are malformed, honor the call (search) and let the caller fall
 * back to the raw user text for the query.
 */
export function parseToolDecision(toolCalls: ToolCallLike[] | null | undefined): SearchDecision {
	const call = (toolCalls ?? []).find((c) => c?.function?.name === "web_search");
	if (!call) {
		return { shouldSearch: false };
	}
	try {
		const args = JSON.parse(call.function?.arguments || "{}");
		const q = typeof args.query === "string" ? args.query.trim() : "";
		return q ? { shouldSearch: true, query: q } : { shouldSearch: true };
	} catch {
		return { shouldSearch: true };
	}
}

/**
 * Ask the model — via real OpenAI tool-calling — whether this turn needs an
 * open-web search, and let it author the query. Best-effort: fails closed to
 * { shouldSearch: false } on any error or short query, never throws, never blocks
 * the turn. Uses the default (chat) model so the decision matches the answerer's
 * tool-calling capability; requires a tools-capable checkpoint (sft-dpo-tools).
 */
export async function decideSearchViaTool(
	query: string,
	locals: App.Locals | undefined
): Promise<SearchDecision> {
	const q = query.trim();
	if (q.length < 3) {
		return { shouldSearch: false };
	}
	try {
		const { OpenAI } = await import("openai");
		const client = new OpenAI({
			apiKey: config.OPENAI_API_KEY || config.HF_TOKEN || "sk-",
			baseURL: config.OPENAI_BASE_URL,
			defaultHeaders: {
				"User-Agent": config.PUBLIC_APP_NAME === "HuggingChat" ? "huggingchat" : "aipotluck-chat",
			},
		});
		const res = await client.chat.completions.create(
			{
				model: defaultModel?.id ?? "",
				messages: [{ role: "user", content: q }],
				tools: [WEB_SEARCH_TOOL],
				tool_choice: "auto",
				stream: false,
				max_tokens: 80,
				temperature: 0,
			},
			{
				headers: {
					"X-use-cache": "false",
					...(config.USE_USER_TOKEN === "true" && locals?.token
						? { Authorization: `Bearer ${locals.token}` }
						: {}),
				},
			}
		);
		return parseToolDecision(res.choices?.[0]?.message?.tool_calls);
	} catch (e) {
		logger.error(e, "search-need tool decision failed");
		return { shouldSearch: false };
	}
}

// ── Margin-based logprob decision (trigger strategy "margin") ───────────────
// The proven path for Apertus-70B-2509 (weak at native tool-calling): ask the yes/no
// classifier with logprobs and decide by the P(yes)−P(no) margin (marginFromLogprobs).
// Validated on evals/search-decision against the served 70B — margin@-0.75 held 85% recall /
// 100% specificity on the HELD-OUT set (generalized; the regex configs overfit). 100%
// specificity is why this is NOT OR'd with the plain recency regex in the caller (that OR
// tanked specificity 100→50). `ok:false` (call failed / no logprobs) lets the caller fall
// back to the recency heuristic. Threshold is deploy-tunable via SEARCH_MARGIN_THRESHOLD.
export type MarginDecision = { shouldSearch: boolean; ok: boolean; margin: number };

export async function decideSearchViaMargin(
	query: string,
	locals: App.Locals | undefined
): Promise<MarginDecision> {
	const q = query.trim();
	if (q.length < 3) {
		return { shouldSearch: false, ok: true, margin: 0 };
	}
	// Reflect.get: SEARCH_MARGIN_THRESHOLD isn't in committed .env (mirrors PUBLIC_SEARCH_TRIGGER).
	const threshold = Number(Reflect.get(config, "SEARCH_MARGIN_THRESHOLD") ?? "") || -0.75;
	try {
		const preprompt = (await getTuning()).searchClassifierPrompt || CLASSIFIER_PREPROMPT;
		const { OpenAI } = await import("openai");
		const client = new OpenAI({
			apiKey: config.OPENAI_API_KEY || config.HF_TOKEN || "sk-",
			baseURL: config.OPENAI_BASE_URL,
			defaultHeaders: {
				"User-Agent": config.PUBLIC_APP_NAME === "HuggingChat" ? "huggingchat" : "aipotluck-chat",
			},
		});
		const res = await client.chat.completions.create(
			{
				model: defaultModel?.id ?? "",
				messages: [
					{ role: "system", content: preprompt },
					{ role: "user", content: `User message: "${q}"` },
				],
				max_tokens: 1,
				temperature: 0,
				logprobs: true,
				top_logprobs: 10,
				stream: false,
			},
			{
				headers: {
					"X-use-cache": "false",
					...(config.USE_USER_TOKEN === "true" && locals?.token
						? { Authorization: `Bearer ${locals.token}` }
						: {}),
				},
			}
		);
		const top = res.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs as TopLogprob[] | undefined;
		if (!top?.length) {
			// No logprobs returned (provider/degenerate) — signal fallback to the heuristic.
			return { shouldSearch: false, ok: false, margin: 0 };
		}
		const v = marginFromLogprobs(top, threshold);
		// Inconclusive: the first token carried NO yes/no probability mass (e.g. the model ignored
		// the single-word format and led with prose). Don't default to searching — signal ok:false
		// so the caller falls back to the recency heuristic instead of over-searching.
		if (v.pYes === 0 && v.pNo === 0) {
			return { shouldSearch: false, ok: false, margin: 0 };
		}
		return { shouldSearch: v.shouldSearch, ok: true, margin: v.margin };
	} catch (e) {
		logger.error(e, "search-need margin decision failed");
		return { shouldSearch: false, ok: false, margin: 0 };
	}
}
