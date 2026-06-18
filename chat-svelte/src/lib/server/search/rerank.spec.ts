import { describe, it, expect } from "vitest";
import { applyRerank } from "./rerank";

// The reorder/threshold logic is the load-bearing pure part of reranking — it
// turns the cross-encoder scores into the final source order. Mirrors the live
// CSCS /v1/rerank shape (off-topic docs score ~0; the on-topic one ~0.8).
describe("applyRerank", () => {
	const cands = ["A", "B", "C"]; // pretend retrieval order

	it("reorders by relevance score (highest first)", () => {
		const results = [
			{ index: 0, relevance_score: 0.00002 },
			{ index: 1, relevance_score: 0.78 },
			{ index: 2, relevance_score: 0.1 },
		];
		expect(applyRerank(cands, results)).toEqual(["B", "C", "A"]);
	});

	it("drops candidates below minScore (kills off-topic retrieval)", () => {
		const results = [
			{ index: 0, relevance_score: 0.00002 }, // off-topic
			{ index: 1, relevance_score: 0.78 }, // on-topic
			{ index: 2, relevance_score: 0.00003 }, // off-topic
		];
		expect(applyRerank(cands, results, { minScore: 0.01 })).toEqual(["B"]);
	});

	it("caps at topK after reordering", () => {
		const results = [
			{ index: 0, relevance_score: 0.9 },
			{ index: 1, relevance_score: 0.8 },
			{ index: 2, relevance_score: 0.7 },
		];
		expect(applyRerank(cands, results, { topK: 2 })).toEqual(["A", "B"]);
	});

	it("never returns empty when started non-empty — falls back to the single best", () => {
		const results = [
			{ index: 0, relevance_score: 0.004 },
			{ index: 1, relevance_score: 0.006 },
			{ index: 2, relevance_score: 0.001 },
		];
		// all below threshold → keep the top-scored one rather than nothing
		expect(applyRerank(cands, results, { minScore: 0.5 })).toEqual(["B"]);
	});

	it("passes candidates through unchanged when there are no results", () => {
		expect(applyRerank(cands, undefined)).toEqual(cands);
		expect(applyRerank(cands, [])).toEqual(cands);
	});

	it("skips result indices that don't map to a candidate", () => {
		const results = [
			{ index: 5, relevance_score: 0.9 }, // out of range
			{ index: 1, relevance_score: 0.5 },
		];
		expect(applyRerank(cands, results)).toEqual(["B"]);
	});
});
