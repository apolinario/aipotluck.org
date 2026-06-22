import { describe, it, expect } from "vitest";
import { needsContextualization, sanitizeRewrite } from "./queryRewrite";

describe("needsContextualization", () => {
	it("flags dangling referential pronouns", () => {
		expect(needsContextualization("what most recent research says about it?")).toBe(true);
		expect(needsContextualization("how does that work")).toBe(true);
		expect(needsContextualization("are they still around")).toBe(true);
		expect(needsContextualization("tell me about the second one")).toBe(true);
	});

	it("flags continuation fragments", () => {
		expect(needsContextualization("and the latest version?")).toBe(true);
		expect(needsContextualization("what about funding")).toBe(true);
		expect(needsContextualization("tell me more")).toBe(true);
	});

	it("leaves a self-contained query alone", () => {
		expect(needsContextualization("what is the biggest dinosaur ever")).toBe(false);
		expect(needsContextualization("current status of the EU AI Act")).toBe(false);
		expect(needsContextualization("open-source vector databases")).toBe(false);
		expect(needsContextualization("")).toBe(false);
	});
});

describe("sanitizeRewrite", () => {
	const fb = "raw query";

	it("strips surrounding quotes and labels", () => {
		expect(sanitizeRewrite('"biggest dinosaur ever"', fb)).toBe("biggest dinosaur ever");
		expect(sanitizeRewrite("Standalone search query: biggest dinosaur", fb)).toBe(
			"biggest dinosaur"
		);
	});

	it("keeps only the first line when the model rambles", () => {
		expect(sanitizeRewrite("biggest dinosaur ever\nThis resolves 'it' to the dinosaur.", fb)).toBe(
			"biggest dinosaur ever"
		);
	});

	it("falls back on empty or over-long output", () => {
		expect(sanitizeRewrite("", fb)).toBe(fb);
		expect(sanitizeRewrite("   ", fb)).toBe(fb);
		expect(sanitizeRewrite("x".repeat(250), fb)).toBe(fb);
	});

	it("passes a clean standalone rewrite through unchanged", () => {
		expect(sanitizeRewrite("most recent research on Argentinosaurus size", fb)).toBe(
			"most recent research on Argentinosaurus size"
		);
	});
});
