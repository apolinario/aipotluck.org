import { describe, it, expect } from "vitest";
import { computeRevealStages } from "./reveal";

describe("computeRevealStages — the live-stack honesty invariant", () => {
	it("a declined turn lights ONLY the safety classifier — never the model", () => {
		// The model never ran on a moderation-declined message; surfacing Apertus
		// would be fabricated provenance. This is the core product invariant.
		expect(computeRevealStages({ moderation: { flagged: true } })).toEqual(["toxicbert"]);
		// even if a (stale/irrelevant) webSearch payload is present, decline wins.
		expect(
			computeRevealStages({ moderation: { flagged: true }, webSearch: { sources: [{}] } })
		).toEqual(["toxicbert"]);
	});

	it("a searched turn reveals search → model, in real pipeline order", () => {
		expect(computeRevealStages({ webSearch: { sources: [{}, {}] } })).toEqual([
			"websearch",
			"apertus",
		]);
	});

	it("a plain turn lights only the model", () => {
		expect(computeRevealStages({})).toEqual(["apertus"]);
		expect(computeRevealStages({ moderation: { flagged: false } })).toEqual(["apertus"]);
	});

	it("an empty search result is not a search turn — no websearch node", () => {
		expect(computeRevealStages({ webSearch: { sources: [] } })).toEqual(["apertus"]);
	});

	it("lights the sovereign compute cell only when the answer ran on it", () => {
		// HF-served (default): no compute node — claiming CSCS would be fabricated.
		expect(computeRevealStages({})).toEqual(["apertus"]);
		// CSCS-served: the model truly ran on Swiss hardware → credit the compute cell, last.
		expect(computeRevealStages({}, { servedOnSovereignCompute: true })).toEqual([
			"apertus",
			"cscs",
		]);
		// Composes with search: search → model → compute.
		expect(
			computeRevealStages({ webSearch: { sources: [{}] } }, { servedOnSovereignCompute: true })
		).toEqual(["websearch", "apertus", "cscs"]);
	});

	it("a declined turn never lights compute, even when sovereign-served", () => {
		// The model (and its compute) never ran; only the safety pre-screen did.
		expect(
			computeRevealStages({ moderation: { flagged: true } }, { servedOnSovereignCompute: true })
		).toEqual(["toxicbert"]);
	});
});
