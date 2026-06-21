// Client-side search resolution: decide whether a turn needs open-web grounding, and if so
// run the search. Extracted from ChatWindow so it can run from the SEND path AFTER the user's
// message is on screen (see conversation/[id] writeMessage) instead of blocking the message
// render — and so the decision logic is unit-testable without a component.
//
// The deciding/searching phases are surfaced via `onPhase` so the caller can show a calm
// status on the pending answer (not an error-colored spinner in the composer). All network
// calls are best-effort and abortable: a failure or a Stop falls back to an ungrounded answer
// rather than blocking or hanging the turn.

import type { SearchContext } from "$lib/types/Search";
import type { SearchTriggerStrategy } from "./triggerStrategy";
import { isRecencyQueryDenoised } from "./recency";
import { shouldRunSearch, usesModelClassifier } from "./triggerStrategy";

/** Classify round-trip budget. "margin" is the default strategy, so this fetch is on EVERY
 *  turn's critical path; a slow/hung classify endpoint (conf-wifi → CSCS) must not hang the
 *  turn — abort after this and fall back to the recency heuristic. */
const CLASSIFY_TIMEOUT_MS = 4500;

export type SearchPhase = "deciding" | "searching";

export interface ResolveSearchOptions {
	strategy: SearchTriggerStrategy;
	base: string;
	/** Caller's abort signal (Stop / navigation / watchdog). Aborts classify and search. */
	signal?: AbortSignal;
	/** Phase callback so the caller can show a calm status on the pending answer. */
	onPhase?: (phase: SearchPhase) => void;
}

/** Model-driven decision: ask the server whether this turn needs open-web grounding. Under
 *  "tool" the model decides via real tool-calling AND authors the query; under "model"/"margin"
 *  it's a yes/no classifier. Best-effort — any failure returns ok:false (→ recency fallback). */
async function classifyNeedsSearch(
	query: string,
	base: string,
	callerSignal?: AbortSignal
): Promise<{ shouldSearch?: boolean; query?: string; ok?: boolean }> {
	const ctrl = new AbortController();
	const onAbort = () => ctrl.abort();
	callerSignal?.addEventListener("abort", onAbort, { once: true });
	const timer = setTimeout(() => ctrl.abort(), CLASSIFY_TIMEOUT_MS);
	try {
		const res = await fetch(`${base}/api/search/classify?q=${encodeURIComponent(query)}`, {
			signal: ctrl.signal,
		});
		if (!res.ok) return { shouldSearch: false, ok: false };
		return (await res.json()) as { shouldSearch?: boolean; query?: string; ok?: boolean };
	} catch {
		// A plain fetch error already means ok:false; this also covers the no-response hang
		// (the real conf-wifi failure mode) and caller abort.
		return { shouldSearch: false, ok: false };
	} finally {
		clearTimeout(timer);
		callerSignal?.removeEventListener("abort", onAbort);
	}
}

/** Resolve whether a turn searches AND which query to run. The model is the primary decider
 *  (strategy "tool"/"model"/"margin"); the recency heuristic is OR'd in as a safety net for
 *  the model's false-negatives. The query is the model's own when it tool-called, else the
 *  raw user text. Pure-ish: the only side effect is the classify fetch. */
export async function decideSearch(
	text: string,
	opts: ResolveSearchOptions
): Promise<{ search: boolean; query: string }> {
	const heuristicHit = isRecencyQueryDenoised(text);
	let modelHit = false;
	let modelQuery: string | undefined;
	let marginOk = true;
	if (usesModelClassifier(opts.strategy)) {
		opts.onPhase?.("deciding");
		const r = await classifyNeedsSearch(text, opts.base, opts.signal);
		modelHit = !!r.shouldSearch;
		modelQuery = r.query;
		// "margin" strategy: ok=false (call failed / no logprobs) → fall back to the recency
		// heuristic. Other strategies don't send `ok` (defaults true).
		marginOk = r.ok ?? true;
	}
	const search = shouldRunSearch({
		heuristicHit,
		classifierHit: modelHit,
		marginOk,
		strategy: opts.strategy,
	});
	return { search, query: modelHit && modelQuery ? modelQuery : text };
}

/** Run the open-web search. Best-effort: a failure degrades to an ungrounded answer rather
 *  than blocking the turn. Returns undefined when nothing grounded the answer. */
export async function runOpenSearch(
	query: string,
	opts: Pick<ResolveSearchOptions, "base" | "signal">
): Promise<SearchContext | undefined> {
	try {
		const res = await fetch(`${opts.base}/api/search?q=${encodeURIComponent(query)}`, {
			signal: opts.signal,
		});
		if (!res.ok) return undefined;
		const result = (await res.json()) as SearchContext;
		return result?.sources?.length ? result : undefined;
	} catch {
		return undefined;
	}
}

/** End-to-end: decide, then (if needed) search. Drives `onPhase` so the caller can show a calm
 *  "checking…/searching…" status on the pending answer. Returns the grounding context, or
 *  undefined for an ungrounded turn. Never throws — the turn proceeds regardless. */
export async function resolveSearchContext(
	text: string,
	opts: ResolveSearchOptions
): Promise<SearchContext | undefined> {
	const { search, query } = await decideSearch(text, opts);
	if (!search) return undefined;
	opts.onPhase?.("searching");
	return runOpenSearch(query, opts);
}
