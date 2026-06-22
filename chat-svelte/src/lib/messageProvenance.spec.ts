import { describe, it, expect } from "vitest";
import {
	searchProvenance,
	ragProvenance,
	moderationMarker,
	showsLiveProvenanceTrace,
	showsCacheNotice,
} from "./messageProvenance";
import type { SearchContext } from "$lib/types/Search";
import type { RagContext } from "$lib/types/Rag";
import type { Message } from "$lib/types/Message";

// These helpers are the SINGLE authority for the provenance markers that the server
// (+server.ts, persisted) and the client (+page.svelte, optimistic during streaming)
// both stamp onto an assistant message. The bug class this guards: those two paths
// previously inlined the same object literal and could silently drift, so a fresh
// streamed answer and the same answer after reload would carry different provenance.
// Collapsing to these functions makes drift impossible; this spec pins their contract.

const sources: SearchContext["sources"] = [
	{ n: 1, title: "EU AI Act", url: "https://example.org/a", snippet: "…", engine: "Wikipedia" },
	{ n: 2, title: "Open web", url: "https://example.org/b", snippet: "…", engine: "Marginalia" },
];

describe("searchProvenance", () => {
	it("stamps query/sources/asOf when the turn was grounded", () => {
		const ctx: SearchContext = {
			query: "eu ai act status",
			sources,
			asOf: "2026-06-19T00:00:00.000Z",
			evidence: "[1] … [2] …",
		};
		expect(searchProvenance(ctx)).toEqual({
			query: "eu ai act status",
			sources,
			asOf: "2026-06-19T00:00:00.000Z",
		});
	});

	it("drops evidence — it feeds the model, is never persisted", () => {
		const ctx: SearchContext = {
			query: "q",
			sources,
			asOf: "2026-06-19T00:00:00.000Z",
			evidence: "SECRET grounding block",
		};
		expect(searchProvenance(ctx)).not.toHaveProperty("evidence");
	});

	it("returns undefined when nothing grounded the turn (no context, or zero sources)", () => {
		// The honest invariant the UI relies on: webSearch is present IFF sources.length > 0.
		// A search that ran but found nothing must NOT produce a webSearch marker — that turn
		// is model-knowledge, and the SourceClass chip says so.
		expect(searchProvenance(undefined)).toBeUndefined();
		expect(searchProvenance(null)).toBeUndefined();
		expect(
			searchProvenance({ query: "q", sources: [], asOf: "2026-06-19T00:00:00.000Z", evidence: "" })
		).toBeUndefined();
	});
});

describe("ragProvenance", () => {
	const ragSources: RagContext["sources"] = [
		{ n: 1, title: "Cloud Compute", snippet: "GPU.", engine: "Potluck" },
	];

	it("stamps query/sources/asOf when catalog retrieval grounded the turn", () => {
		const ctx: RagContext = {
			query: "cloud compute oss",
			sources: ragSources,
			asOf: "2026-06-19T00:00:00.000Z",
			evidence: "[1] Cloud Compute (Potluck)",
		};
		expect(ragProvenance(ctx)).toEqual({
			query: "cloud compute oss",
			sources: ragSources,
			asOf: "2026-06-19T00:00:00.000Z",
			vaultSynthesis: undefined,
		});
	});

	it("stamps vault synthesis without numbered sources", () => {
		const ctx: RagContext = {
			query: "personality in Vaud",
			sources: [],
			asOf: "2026-06-19T00:00:00.000Z",
			evidence: "",
			vaultSynthesis: "Charlie Chaplin lived in Vevey.",
		};
		expect(ragProvenance(ctx)).toEqual({
			query: "personality in Vaud",
			sources: [],
			asOf: "2026-06-19T00:00:00.000Z",
			vaultSynthesis: "Charlie Chaplin lived in Vevey.",
		});
	});

	it("drops evidence — it feeds the model, is never persisted", () => {
		const ctx: RagContext = {
			query: "q",
			sources: ragSources,
			asOf: "2026-06-19T00:00:00.000Z",
			evidence: "SECRET grounding block",
		};
		expect(ragProvenance(ctx)).not.toHaveProperty("evidence");
	});

	it("returns undefined when nothing grounded the turn", () => {
		expect(ragProvenance(undefined)).toBeUndefined();
		expect(ragProvenance(null)).toBeUndefined();
		expect(
			ragProvenance({
				query: "q",
				sources: [],
				asOf: "2026-06-19T00:00:00.000Z",
				evidence: "",
			})
		).toBeUndefined();
	});
});

describe("moderationMarker", () => {
	it("always sets flagged:true (a marker only exists on a decline)", () => {
		const m = moderationMarker({ label: "toxic", score: 0.97, kind: "toxicity" });
		expect(m.flagged).toBe(true);
	});

	it("carries label/score/kind through unchanged (toxicity)", () => {
		expect(moderationMarker({ label: "toxic", score: 0.97, kind: "toxicity" })).toEqual({
			flagged: true,
			label: "toxic",
			score: 0.97,
			kind: "toxicity",
		});
	});

	it("carries the child-safety kind through (server's isChild branch)", () => {
		expect(moderationMarker({ label: "child_safety", score: 1, kind: "child_safety" })).toEqual({
			flagged: true,
			label: "child_safety",
			score: 1,
			kind: "child_safety",
		});
	});

	it("preserves a null label", () => {
		expect(moderationMarker({ label: null, score: 0.8, kind: "toxicity" }).label).toBeNull();
	});
});

describe("cache-fallback provenance gate", () => {
	const msg = (over: Partial<Message>): Pick<Message, "from" | "servedFromCache"> => ({
		from: "assistant",
		servedFromCache: undefined,
		...over,
	});

	it("shows the live trace (not the cache notice) for a normal assistant answer", () => {
		const m = msg({});
		expect(showsLiveProvenanceTrace(m)).toBe(true);
		expect(showsCacheNotice(m)).toBe(false);
	});

	it("shows the cache notice (not the live trace) when served from cache", () => {
		const m = msg({ servedFromCache: true });
		expect(showsCacheNotice(m)).toBe(true);
		expect(showsLiveProvenanceTrace(m)).toBe(false);
	});

	it("is mutually exclusive for every assistant message — never claims both at once", () => {
		// The core honesty invariant: a turn can never read as BOTH "served from a saved
		// answer" AND "freshly generated live". Exactly one surface shows on an assistant turn.
		for (const servedFromCache of [undefined, false, true]) {
			const m = msg({ servedFromCache });
			expect(showsLiveProvenanceTrace(m)).not.toBe(showsCacheNotice(m));
		}
	});

	it("shows neither on user or system turns", () => {
		for (const from of ["user", "system"] as const) {
			expect(showsLiveProvenanceTrace(msg({ from }))).toBe(false);
			expect(showsCacheNotice(msg({ from, servedFromCache: true }))).toBe(false);
		}
	});
});
