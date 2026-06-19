import { describe, it, expect } from "vitest";
import { buildPersonaPrompt, resolveDecoding, GROUNDED_DECODING } from "./persona";

describe("buildPersonaPrompt", () => {
	it("default: fills all identity tokens (no {token} placeholder leaks through)", () => {
		const out = buildPersonaPrompt("swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo-tools");
		expect(out).not.toMatch(/\{(model|maker|served|training)\}/);
		expect(out).toContain("AI Potluck");
	});

	it("override: replaces the prose but still fills the identity tokens", () => {
		const out = buildPersonaPrompt("swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo-tools", "Intro. You run on {model}.");
		expect(out.startsWith("Intro. You run on ")).toBe(true);
		expect(out).not.toContain("{model}"); // token filled with the real identity
		expect(out).not.toContain("neutral, open-source AI assistant"); // default prose gone
	});

	it("override is free text — a token-less override is used verbatim (trusted editor)", () => {
		// Documents the real boundary: tokens prevent ACCIDENTAL staleness, not a deliberate
		// wrong identity. The panel is admin-gated; editors are trusted.
		expect(buildPersonaPrompt("m", "You are a teapot.")).toBe("You are a teapot.");
	});

	it("blank/whitespace override falls back to the default template", () => {
		const dflt = buildPersonaPrompt("m");
		expect(buildPersonaPrompt("m", "")).toBe(dflt);
		expect(buildPersonaPrompt("m", "   ")).toBe(dflt);
	});
});

describe("resolveDecoding", () => {
	it("no override returns the code defaults", () => {
		expect(resolveDecoding()).toEqual(GROUNDED_DECODING);
	});

	it("merges a partial override over the defaults", () => {
		const out = resolveDecoding({ temperature: 0.5 });
		expect(out.temperature).toBe(0.5);
		expect(out.max_tokens).toBe(GROUNDED_DECODING.max_tokens);
		expect(out.frequency_penalty).toBe(GROUNDED_DECODING.frequency_penalty);
	});
});
