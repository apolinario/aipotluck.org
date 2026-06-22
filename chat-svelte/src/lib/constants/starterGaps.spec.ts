import { describe, it, expect } from "vitest";
import { gapForPrompt, normalizeStarter } from "./starterGaps";

const FUNDER =
	"What's happened with open-source AI funding or policy in the last month? I'm prepping a board decision and need current sources I can check.";
const BUILDER =
	"I'm building a chatbot on open components. What open-source options exist for the model, vector store, and moderation layer — and where is the open stack still thin?";

describe("starterGaps", () => {
	it("maps the funder prompt to the websearch gap (node meaning matches the ask)", () => {
		expect(gapForPrompt(FUNDER)).toEqual({
			node: "websearch",
			ask: "a Google-scale open web search index",
		});
	});

	it("matches despite whitespace / case differences (chip vs paste)", () => {
		expect(gapForPrompt(`  ${FUNDER.toUpperCase()}  `)?.node).toBe("websearch");
	});

	it("surfaces NO gap for the builder prompt — it spans layers with no single matching node", () => {
		expect(gapForPrompt(BUILDER)).toBeUndefined();
	});

	it("returns undefined for uncurated / empty / nullish input (never infers a gap)", () => {
		expect(gapForPrompt("What model are you running on right now?")).toBeUndefined();
		expect(gapForPrompt("")).toBeUndefined();
		expect(gapForPrompt(undefined)).toBeUndefined();
		expect(gapForPrompt(null)).toBeUndefined();
	});

	it("normalizeStarter collapses whitespace and lowercases", () => {
		expect(normalizeStarter("  Foo   Bar\n")).toBe("foo bar");
	});
});
