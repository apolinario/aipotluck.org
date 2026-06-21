/**
 * Send-path search resolution (decideSearch / runOpenSearch / resolveSearchContext).
 *
 * This module moved OFF the composer onto the send path (so the user's message renders before
 * grounding resolves), so its decision logic is now the only place the client decides whether a
 * turn searches. The contract under test:
 *   - "heuristic" strategy never calls the classify endpoint (no server round-trip, no "deciding")
 *   - classifier strategies (model/tool/margin) call classify and fire onPhase("deciding")
 *   - a failed/aborted classify degrades safely (margin → recency fallback; never throws)
 *   - the run query is the model's own when it tool-called, else the raw text
 *   - runOpenSearch is best-effort: only a non-empty source set grounds; everything else → undefined
 *   - resolveSearchContext only searches (and fires onPhase("searching")) when the decision is yes
 *   - the caller's abort signal is honored on both fetches
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { decideSearch, runOpenSearch, resolveSearchContext } from "./resolveSearch";
import { isRecencyQueryDenoised } from "./recency";

type ClassifyBody = { shouldSearch?: boolean; query?: string };
function stubFetch(opts: {
	classify?: ClassifyBody | Error | { status: number };
	classifyAssert?: (url: string, init?: RequestInit) => void;
	search?: { sources?: unknown[] } | Error | { status: number };
}) {
	const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
		const u = String(url);
		if (u.includes("/api/search/classify")) {
			opts.classifyAssert?.(u, init);
			const c = opts.classify;
			if (c instanceof Error) throw c;
			if (c && "status" in c) return new Response("", { status: c.status });
			return new Response(JSON.stringify(c ?? {}), { status: 200 });
		}
		if (u.includes("/api/search")) {
			const s = opts.search;
			if (s instanceof Error) throw s;
			if (s && "status" in s) return new Response("", { status: s.status });
			return new Response(JSON.stringify(s ?? { sources: [] }), { status: 200 });
		}
		throw new Error(`unexpected fetch ${u}`);
	});
	vi.stubGlobal("fetch", fetchImpl);
	return fetchImpl;
}

afterEach(() => vi.unstubAllGlobals());

const base = "";

describe("decideSearch", () => {
	it("'heuristic' strategy never calls classify and never fires onPhase('deciding')", async () => {
		const fetchImpl = stubFetch({});
		const phases: string[] = [];
		const r = await decideSearch("what is the latest news today", {
			strategy: "heuristic",
			base,
			onPhase: (p) => phases.push(p),
		});
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(phases).not.toContain("deciding");
		// On heuristic strategy the result is exactly the heuristic verdict.
		expect(r.search).toBe(isRecencyQueryDenoised("what is the latest news today"));
	});

	it("'margin' strategy calls classify, fires onPhase('deciding'), and follows the classifier", async () => {
		const fetchImpl = stubFetch({ classify: { shouldSearch: true } });
		const phases: string[] = [];
		const r = await decideSearch("anything", {
			strategy: "margin",
			base,
			onPhase: (p) => phases.push(p),
		});
		expect(fetchImpl).toHaveBeenCalledOnce();
		expect(phases).toContain("deciding");
		expect(r.search).toBe(true);
	});

	it("'margin' with classifier NO does not search", async () => {
		stubFetch({ classify: { shouldSearch: false } });
		const r = await decideSearch("a timeless question", { strategy: "margin", base });
		expect(r.search).toBe(false);
	});

	it("uses the model's query when it tool-called, else the raw text", async () => {
		stubFetch({ classify: { shouldSearch: true, query: "refined query" } });
		expect((await decideSearch("raw", { strategy: "margin", base })).query).toBe("refined query");
		stubFetch({ classify: { shouldSearch: true } });
		expect((await decideSearch("raw", { strategy: "margin", base })).query).toBe("raw");
	});

	it("a thrown classify degrades safely: margin falls back to the recency heuristic", async () => {
		const phrase = "what are the latest headlines right now today";
		stubFetch({ classify: new Error("network down") });
		const r = await decideSearch(phrase, { strategy: "margin", base });
		// marginOk=false → shouldRunSearch falls back to the heuristic verdict; never throws.
		expect(r.search).toBe(isRecencyQueryDenoised(phrase));
	});

	it("a non-200 classify is treated as ok:false (no throw)", async () => {
		const phrase = "a plain factual question with no recency";
		stubFetch({ classify: { status: 503 } });
		const r = await decideSearch(phrase, { strategy: "margin", base });
		expect(r.search).toBe(isRecencyQueryDenoised(phrase));
	});

	it("forwards the caller's abort signal to classify", async () => {
		let seen: AbortSignal | undefined;
		stubFetch({
			classify: { shouldSearch: false },
			classifyAssert: (_u, init) => (seen = init?.signal ?? undefined),
		});
		const ctrl = new AbortController();
		await decideSearch("q", { strategy: "margin", base, signal: ctrl.signal });
		expect(seen).toBeInstanceOf(AbortSignal);
	});
});

describe("runOpenSearch", () => {
	it("returns the context when sources are present", async () => {
		stubFetch({ search: { sources: [{ title: "t", url: "u" }] } });
		const ctx = await runOpenSearch("q", { base });
		expect(ctx?.sources?.length).toBe(1);
	});

	it("returns undefined when the search has no sources", async () => {
		stubFetch({ search: { sources: [] } });
		expect(await runOpenSearch("q", { base })).toBeUndefined();
	});

	it("returns undefined on a non-200 response", async () => {
		stubFetch({ search: { status: 500 } });
		expect(await runOpenSearch("q", { base })).toBeUndefined();
	});

	it("returns undefined (never throws) on a network error", async () => {
		stubFetch({ search: new Error("offline") });
		expect(await runOpenSearch("q", { base })).toBeUndefined();
	});
});

describe("resolveSearchContext", () => {
	it("does NOT search (or fire onPhase('searching')) when the decision is no", async () => {
		const fetchImpl = stubFetch({ classify: { shouldSearch: false } });
		const phases: string[] = [];
		const ctx = await resolveSearchContext("timeless", {
			strategy: "margin",
			base,
			onPhase: (p) => phases.push(p),
		});
		expect(ctx).toBeUndefined();
		expect(phases).not.toContain("searching");
		// classify fetched, /api/search NOT.
		expect(fetchImpl).toHaveBeenCalledOnce();
	});

	it("searches and fires onPhase('searching') when the decision is yes", async () => {
		stubFetch({
			classify: { shouldSearch: true },
			search: { sources: [{ title: "t", url: "u" }] },
		});
		const phases: string[] = [];
		const ctx = await resolveSearchContext("recent thing", {
			strategy: "margin",
			base,
			onPhase: (p) => phases.push(p),
		});
		expect(phases).toEqual(["deciding", "searching"]);
		expect(ctx?.sources?.length).toBe(1);
	});
});
