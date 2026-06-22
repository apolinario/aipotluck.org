import { describe, it, expect } from "vitest";
import {
	detectContentFreeChallenge,
	injectRederivationScaffold,
	REDERIVATION_SCAFFOLD,
} from "./challengeGuard";

const PRIOR = "The answer is D — Nauru.";

describe("detectContentFreeChallenge", () => {
	it("fires on bare content-free pushback after a prior answer", () => {
		for (const u of [
			"I don't think that's right. Are you sure?",
			"Are you sure?",
			"that's wrong",
			"you're wrong",
			"Really?",
			"hmm, can you double-check?",
			"I disagree.",
		]) {
			expect(detectContentFreeChallenge({ priorAssistant: PRIOR, userText: u })).toBe(true);
		}
	});

	it("does NOT fire when the user supplies a real correction (new info → honor it)", () => {
		for (const u of [
			"No, it's B because Vatican City is under a square mile.",
			"That's wrong, the answer is actually A.",
			"I think it should be 1492, not 1493.",
			"No, the correct answer is Monaco.",
		]) {
			expect(detectContentFreeChallenge({ priorAssistant: PRIOR, userText: u })).toBe(false);
		}
	});

	it("does NOT fire without a prior assistant turn (nothing to challenge)", () => {
		expect(detectContentFreeChallenge({ priorAssistant: "", userText: "are you sure?" })).toBe(
			false
		);
		expect(detectContentFreeChallenge({ userText: "are you sure?" })).toBe(false);
	});

	it("does NOT fire on ordinary follow-up questions", () => {
		for (const u of [
			"Can you explain why?",
			"What's the population of Nauru?",
			"Thanks, and what about the largest?",
		]) {
			expect(detectContentFreeChallenge({ priorAssistant: PRIOR, userText: u })).toBe(false);
		}
	});

	it("does NOT fire on a long argued pushback (that's a substantive disagreement)", () => {
		const longArgued =
			"are you sure about that, because I read somewhere that the metric actually counts inland water area separately and that would change which country qualifies here";
		expect(detectContentFreeChallenge({ priorAssistant: PRIOR, userText: longArgued })).toBe(false);
	});

	it("handles empty/undefined safely", () => {
		expect(detectContentFreeChallenge({})).toBe(false);
		expect(detectContentFreeChallenge({ priorAssistant: PRIOR, userText: "" })).toBe(false);
	});
});

describe("injectRederivationScaffold", () => {
	it("appends the scaffold last (highest salience)", () => {
		const out = injectRederivationScaffold("SYSTEM PROMPT");
		expect(out.startsWith("SYSTEM PROMPT")).toBe(true);
		expect(out.endsWith(REDERIVATION_SCAFFOLD)).toBe(true);
	});
});
