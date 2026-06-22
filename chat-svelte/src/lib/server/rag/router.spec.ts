import { describe, it, expect } from "vitest";
import { matchesEpfl, matchesVault, heuristicSources, parseClassifier } from "./router";

describe("rag router heuristics", () => {
	it("routes EPFL/Swiss-research cues to the EPFL store", () => {
		expect(matchesEpfl("Tell me about meditron")).toBe(true);
		expect(matchesEpfl("What is EPFL working on?")).toBe(true);
		expect(matchesEpfl("latest Lausanne research news")).toBe(true);
		expect(matchesEpfl("how do transformers work?")).toBe(false);
	});

	it("routes Swiss local-culture cues to the vault store", () => {
		expect(matchesVault("What is an important personality that lived in Vaud?")).toBe(true);
		expect(matchesVault("Who lived in Vevey?")).toBe(true);
		expect(matchesVault("tell me about a canton")).toBe(true);
		expect(matchesVault("what is retrieval augmented generation?")).toBe(false);
	});

	it("always keeps the local catalog store on (the product default)", () => {
		// No SyftHub token in the test env, so federated stores stay off regardless of cues.
		expect(heuristicSources("anything at all").local).toBe(true);
		expect(heuristicSources("meditron at EPFL in Vaud").epfl).toBe(false);
		expect(heuristicSources("meditron at EPFL in Vaud").vault).toBe(false);
	});
});

describe("rag classifier parsing", () => {
	it("extracts federated labels from the model output", () => {
		expect(parseClassifier("epfl")).toEqual({ epfl: true, vault: false });
		expect(parseClassifier("vault")).toEqual({ epfl: false, vault: true });
		expect(parseClassifier("epfl,vault")).toEqual({ epfl: true, vault: true });
		expect(parseClassifier("none")).toEqual({ epfl: false, vault: false });
		expect(parseClassifier(undefined)).toEqual({ epfl: false, vault: false });
	});
});
