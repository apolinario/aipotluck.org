import { describe, it, expect } from "vitest";
import { isRecencyQuery } from "./recency";

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
		expect(isRecencyQuery("status of Apertus 1.5 release")).toBe(true);
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
