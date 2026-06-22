import { describe, it, expect } from "vitest";
import { gapForPrompt, normalizeStarter } from "./starterGaps";

// The curated GAPS registry is intentionally EMPTY right now (the entry was keyed to the retired
// EU-AI-Act starter; see suggestions.ts / starterGaps.ts). These tests pin the MECHANISM so the
// gap-CTA feature stays correct and a future entry can be added safely:
//   - no entry → no CTA for ANY prompt (the honesty default — never infer a gap),
//   - normalization still collapses whitespace/case for when an entry returns.
describe("starterGaps", () => {
	it("surfaces no gap while the registry is empty — never infers one", () => {
		expect(
			gapForPrompt(
				"I need the current status of the EU AI Act for a policy briefing next week. How do you find that?"
			)
		).toBeUndefined();
		expect(gapForPrompt("What open-source vector databases exist?")).toBeUndefined();
	});

	it("returns undefined for empty / nullish input", () => {
		expect(gapForPrompt("")).toBeUndefined();
		expect(gapForPrompt(undefined)).toBeUndefined();
		expect(gapForPrompt(null)).toBeUndefined();
	});

	it("normalizeStarter collapses whitespace and lowercases (so chip vs paste match)", () => {
		expect(normalizeStarter("  Foo   Bar\n")).toBe("foo bar");
		expect(normalizeStarter("EU  AI  ACT")).toBe("eu ai act");
	});
});
