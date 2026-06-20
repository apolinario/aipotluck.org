import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeRevealStages, computePulseNodes, ALL_STACK_NODE_IDS } from "./reveal";

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

describe("computePulseNodes — streaming pulse honesty (same gates, applied live)", () => {
	it("a plain streaming turn pulses only the model", () => {
		expect(computePulseNodes({})).toEqual(["apertus"]);
	});

	it("a grounded streaming turn also pulses the web-search node", () => {
		expect(computePulseNodes({ grounded: true })).toEqual(["apertus", "websearch"]);
	});

	it("NEVER pulses the sovereign compute cell while HF-served — false-sovereignty regression guard", () => {
		// The pulse seam once lit cscs on every turn regardless of serving; that visually
		// claimed Swiss compute while HF-served. It must mirror reveal.ts's gate exactly.
		expect(computePulseNodes({})).not.toContain("cscs");
		expect(computePulseNodes({ grounded: true })).not.toContain("cscs");
	});

	it("pulses the compute cell only when the answer truly runs on sovereign compute", () => {
		expect(computePulseNodes({ servedOnSovereignCompute: true })).toEqual(["apertus", "cscs"]);
		expect(computePulseNodes({ grounded: true, servedOnSovereignCompute: true })).toEqual([
			"apertus",
			"websearch",
			"cscs",
		]);
	});
});

describe("stack node-id authority — every authority id exists in stack-map.json", () => {
	it("no dispatcher constant can target a node the map doesn't define", () => {
		// The whole point of centralizing node ids: a rename in stack-map.json must break
		// THIS test, not silently leave a flash/pulse pointing at a dead node.
		const raw = readFileSync(resolve(process.cwd(), "static/data/stack-map.json"), "utf-8");
		const map = JSON.parse(raw) as { layers: { nodes: { id: string }[] }[] };
		const ids = new Set(map.layers.flatMap((l) => l.nodes.map((n) => n.id)));
		for (const id of ALL_STACK_NODE_IDS) {
			expect(ids.has(id), `node id "${id}" is missing from static/data/stack-map.json`).toBe(true);
		}
	});
});
