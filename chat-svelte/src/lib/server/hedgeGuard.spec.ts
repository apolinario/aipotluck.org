import { describe, it, expect } from "vitest";
import { detectRecencyHedge } from "./hedgeGuard";

describe("detectRecencyHedge", () => {
	it("strips a trailing 'consult recent sources' recency hedge", () => {
		const text =
			"Argentinosaurus is the largest known dinosaur, at roughly 70-100 tons. For the latest estimates, consult recent paleontology research.";
		const { hedged, cleaned } = detectRecencyHedge(text);
		expect(hedged).toBe(true);
		expect(cleaned).not.toMatch(/consult recent/i);
		expect(cleaned).toContain("Argentinosaurus is the largest known dinosaur");
	});

	it("strips an 'as of my last update' disclaimer", () => {
		const text = "As of my last update, the EU AI Act was in negotiation. It entered into force in 2024.";
		const { hedged, cleaned } = detectRecencyHedge(text);
		expect(hedged).toBe(true);
		expect(cleaned).not.toMatch(/as of my last update/i);
		expect(cleaned).toContain("It entered into force in 2024.");
	});

	it("strips a real-time-access capability disclaimer", () => {
		const text =
			"I can't access real-time information. The sources above indicate the law is now in force.";
		const { hedged, cleaned } = detectRecencyHedge(text);
		expect(hedged).toBe(true);
		expect(cleaned).not.toMatch(/can't access real-time/i);
		expect(cleaned).toContain("The sources above indicate the law is now in force.");
	});

	it("leaves a hedge-free grounded answer untouched", () => {
		const text = "The EU AI Act entered into force on 1 August 2024 and applies in phases.";
		const { hedged, cleaned } = detectRecencyHedge(text);
		expect(hedged).toBe(false);
		expect(cleaned).toBe(text);
	});

	it("does NOT strip a substantive sentence that merely mentions training data", () => {
		const text = "Models like this are trained on large text datasets scraped from the web.";
		const { hedged } = detectRecencyHedge(text);
		expect(hedged).toBe(false);
	});

	it("bails to the original when stripping would gut the answer", () => {
		// The only sentence IS the hedge — stripping leaves nothing, so keep the original (the chip
		// still says 'looked it up'); we never return an empty answer.
		const text = "My knowledge may be out of date, so this might have changed.";
		const { hedged, cleaned } = detectRecencyHedge(text);
		expect(hedged).toBe(true);
		expect(cleaned).toBe(text);
	});

	it("handles empty input", () => {
		expect(detectRecencyHedge("")).toEqual({ hedged: false, cleaned: "" });
	});
});
