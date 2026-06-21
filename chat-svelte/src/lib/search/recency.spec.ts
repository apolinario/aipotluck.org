import { describe, it, expect } from "vitest";
import { isRecencyQuery, isRecencyQueryDenoised, isTechnicalContext } from "./recency";

// As of 2026-06-18 this heuristic is load-bearing: it is the "layer" that DECIDES
// whether a turn runs an open-web search (no manual toggle anymore — see
// ChatWindow.handleSubmit). A false positive costs latency + injects sources; a
// false negative silently answers stale from training. These tests pin the
// trigger boundary so a regex tweak can't quietly change what auto-searches.
describe("isRecencyQuery — the auto-search trigger", () => {
	it("fires on explicit recency words", () => {
		expect(isRecencyQuery("what is the latest news on the EU AI Act?")).toBe(true);
		expect(isRecencyQuery("who is the current president of Switzerland")).toBe(true);
		expect(isRecencyQuery("what happened this week in open AI")).toBe(true);
		expect(isRecencyQuery("status of the next Apertus release")).toBe(true);
	});

	it("fires on explicit years (2024+)", () => {
		expect(isRecencyQuery("biggest open models of 2025")).toBe(true);
		expect(isRecencyQuery("what shipped in 2030")).toBe(true);
	});

	it("fires on the documented look-it-up scenario", () => {
		expect(isRecencyQuery("can you look that up for me")).toBe(true);
		expect(isRecencyQuery("how do you find out which model is newest")).toBe(true);
		expect(isRecencyQuery("please fact-check this claim")).toBe(true);
	});

	it("does NOT fire on timeless / training-answerable questions", () => {
		expect(isRecencyQuery("explain how a transformer attention head works")).toBe(false);
		expect(isRecencyQuery("write a haiku about the ocean")).toBe(false);
		expect(isRecencyQuery("what is the capital of France")).toBe(false);
		expect(isRecencyQuery("refactor this function to be pure")).toBe(false);
	});

	it("does NOT fire on trivially short or empty drafts", () => {
		expect(isRecencyQuery("")).toBe(false);
		expect(isRecencyQuery("hi")).toBe(false);
		expect(isRecencyQuery("   ")).toBe(false);
	});

	it("does not match years before 2024 (no over-firing on historical dates)", () => {
		expect(isRecencyQuery("what happened in 2010")).toBe(false);
		expect(isRecencyQuery("summarize the 1999 dot-com boom")).toBe(false);
	});
});

describe("isRecencyQueryDenoised (de-noised search fast-path)", () => {
	it("suppresses the recency signal on obvious coding/technical how-tos", () => {
		// raw heuristic fires (trap words), de-noise correctly suppresses
		for (const q of [
			"how do I get the current date in Python?",
			"how do I check the status of a systemd service?",
			"what does the latest tag mean in a Docker image?",
			"how do I print the current working directory in bash?",
			"what's the current flowing through a 10-ohm resistor?",
		]) {
			expect(isRecencyQuery(q)).toBe(true);
			expect(isTechnicalContext(q)).toBe(true);
			expect(isRecencyQueryDenoised(q)).toBe(false);
		}
	});

	it("still fires on genuine current-events recency (non-technical)", () => {
		for (const q of [
			"what is the latest news on the EU AI Act?",
			"what is the current price of Bitcoin?",
			"who won the most recent F1 race?",
			"what are today's headlines?",
		]) {
			expect(isRecencyQueryDenoised(q)).toBe(true);
		}
	});

	it("leaves timeless coding questions non-firing either way (no trap word)", () => {
		expect(isRecencyQuery("write a python function to reverse a list")).toBe(false);
		expect(isRecencyQueryDenoised("write a python function to reverse a list")).toBe(false);
	});

	it("over-suppresses genuinely-current technical queries (documented; model backstops)", () => {
		// "latest Node.js release" IS current info, but the technical filter suppresses it.
		// Acceptable: in the model/tool strategy the classifier still catches it.
		expect(isRecencyQuery("what is the latest stable Node.js release?")).toBe(true);
		expect(isRecencyQueryDenoised("what is the latest stable Node.js release?")).toBe(false);
	});
});
