import { describe, it, expect } from "vitest";
import { gapForPrompt, normalizeStarter } from "./starterGaps";

describe("starterGaps", () => {
	const euAct =
		"I need the current status of the EU AI Act for a policy briefing next week. How do you find that?";

	it("matches a curated gap prompt to a node whose meaning matches the ask", () => {
		expect(gapForPrompt(euAct)).toEqual({
			node: "websearch",
			ask: "a Google-scale open web search index",
		});
	});

	it("matches despite whitespace / case differences (chip vs paste)", () => {
		expect(gapForPrompt(`  ${euAct.toUpperCase()}  `)?.node).toBe("websearch");
		expect(gapForPrompt(euAct.replace(/ /g, "  "))?.node).toBe("websearch");
	});

	it("does NOT surface a gap for the farmer prompt — its real gap (local data) has no honest node yet", () => {
		const farmer =
			"A farmer in Rwanda is asking about drought-resistant crops for this season. What can you actually help with, and where are your limits?";
		expect(gapForPrompt(farmer)).toBeUndefined();
	});

	it("returns undefined for prompts that target no gap, and for empty input", () => {
		expect(gapForPrompt("What model are you running on right now?")).toBeUndefined();
		expect(gapForPrompt("")).toBeUndefined();
		expect(gapForPrompt(undefined)).toBeUndefined();
		expect(gapForPrompt(null)).toBeUndefined();
	});

	it("normalizeStarter collapses whitespace and lowercases", () => {
		expect(normalizeStarter("  Foo   Bar\n")).toBe("foo bar");
	});
});
