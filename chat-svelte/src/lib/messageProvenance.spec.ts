import { describe, it, expect } from "vitest";
import { searchProvenance, moderationMarker } from "./messageProvenance";
import type { SearchContext } from "$lib/types/Search";

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
