import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	computeRevealStages,
	computePulseNodes,
	ALL_STACK_NODE_IDS,
	CATALOG_RAG_NODE,
	EPFL_RAG_NODE,
	VAULT_NODE,
} from "./reveal";

describe("computeRevealStages — the live-stack honesty invariant", () => {
	it("a declined turn lights ONLY the safety classifier — never the model", () => {
		expect(computeRevealStages({ moderation: { flagged: true } })).toEqual(["toxicbert"]);
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

	it("a RAG catalog turn reveals catalog-rag → model", () => {
		expect(
			computeRevealStages({
				rag: { sources: [{ engine: "Potluck", n: 1, title: "T", snippet: "S" }] },
			})
		).toEqual([CATALOG_RAG_NODE, "apertus"]);
	});

	it("a federated EPFL turn reveals syft-epfl → model", () => {
		expect(
			computeRevealStages({
				rag: { sources: [{ engine: "SyftHub:EPFL", n: 1, title: "T", snippet: "S" }] },
			})
		).toEqual([EPFL_RAG_NODE, "apertus"]);
	});

	it("a vault synthesis turn reveals localculture → model", () => {
		expect(computeRevealStages({ rag: { vaultSynthesis: "Charlie Chaplin lived in Vevey." } })).toEqual(
			[VAULT_NODE, "apertus"]
		);
	});

	it("web + RAG compose in pipeline order before model", () => {
		expect(
			computeRevealStages({
				webSearch: { sources: [{}] },
				rag: { sources: [{ engine: "Potluck", n: 1, title: "T", snippet: "S" }] },
			})
		).toEqual(["websearch", CATALOG_RAG_NODE, "apertus"]);
	});

	it("a plain turn lights only the model", () => {
		expect(computeRevealStages({})).toEqual(["apertus"]);
		expect(computeRevealStages({ moderation: { flagged: false } })).toEqual(["apertus"]);
	});

	it("an empty search result is not a search turn — no websearch node", () => {
		expect(computeRevealStages({ webSearch: { sources: [] } })).toEqual(["apertus"]);
	});

	it("lights the sovereign compute cell only when the answer ran on it", () => {
		expect(computeRevealStages({})).toEqual(["apertus"]);
		expect(computeRevealStages({}, { servedOnSovereignCompute: true })).toEqual([
			"apertus",
			"cscs",
		]);
		expect(
			computeRevealStages({ webSearch: { sources: [{}] } }, { servedOnSovereignCompute: true })
		).toEqual(["websearch", "apertus", "cscs"]);
	});

	it("a declined turn never lights compute, even when sovereign-served", () => {
		expect(
			computeRevealStages({ moderation: { flagged: true } }, { servedOnSovereignCompute: true })
		).toEqual(["toxicbert"]);
	});
});

describe("computePulseNodes — streaming pulse honesty (same gates, applied live)", () => {
	it("a plain streaming turn pulses only the model", () => {
		expect(computePulseNodes({})).toEqual(["apertus"]);
	});

	it("a web-grounded streaming turn also pulses the web-search node", () => {
		expect(computePulseNodes({ webGrounded: true })).toEqual(["apertus", "websearch"]);
	});

	it("a RAG streaming turn pulses the matching retrieval nodes", () => {
		expect(
			computePulseNodes({
				rag: { sources: [{ engine: "Potluck", n: 1, title: "T", snippet: "S" }] },
			})
		).toEqual(["apertus", CATALOG_RAG_NODE]);
	});

	it("NEVER pulses the sovereign compute cell while HF-served — false-sovereignty regression guard", () => {
		expect(computePulseNodes({})).not.toContain("cscs");
		expect(computePulseNodes({ webGrounded: true })).not.toContain("cscs");
	});

	it("pulses the compute cell only when the answer truly runs on sovereign compute", () => {
		expect(computePulseNodes({ servedOnSovereignCompute: true })).toEqual(["apertus", "cscs"]);
		expect(computePulseNodes({ webGrounded: true, servedOnSovereignCompute: true })).toEqual([
			"apertus",
			"websearch",
			"cscs",
		]);
	});
});

describe("stack node-id authority — every authority id exists in stack-map.json", () => {
	it("no dispatcher constant can target a node the map doesn't define", () => {
		const raw = readFileSync(resolve(process.cwd(), "static/data/stack-map.json"), "utf-8");
		const map = JSON.parse(raw) as { layers: { nodes: { id: string }[] }[] };
		const ids = new Set(map.layers.flatMap((l) => l.nodes.map((n) => n.id)));
		for (const id of ALL_STACK_NODE_IDS) {
			expect(ids.has(id), `node id "${id}" is missing from static/data/stack-map.json`).toBe(true);
		}
	});
});
