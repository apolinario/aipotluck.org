import { describe, it, expect } from "vitest";
import { searchGroundingPrompt, injectSearchGroundingPrompt } from "./searchGrounding";

const EV = "[1] Title (Wikipedia)\nsnippet\nhttps://x";
const ASOF = "2026-06-18T12:00:00.000Z";

describe("searchGroundingPrompt", () => {
	it("default fills {asOf} (date only) and {evidence}, keeps the cite instruction", () => {
		const out = searchGroundingPrompt(EV, ASOF);
		expect(out).toContain("2026-06-18");
		expect(out).not.toContain("12:00:00"); // date sliced, not full ISO
		expect(out).toContain("[1] Title");
		expect(out).toContain("Cite every factual claim");
	});

	it("override template fills its {asOf}/{evidence} tokens", () => {
		const out = searchGroundingPrompt(EV, ASOF, "As of {asOf}:\n{evidence}\nCite [n].");
		expect(out).toBe(`As of 2026-06-18:\n${EV}\nCite [n].`);
	});

	it("SAFETY NET: an override that drops {evidence} still gets the sources appended", () => {
		// Prevents an editor from accidentally un-grounding the answer.
		const out = searchGroundingPrompt(EV, ASOF, "Answer from the sources. Cite [n].");
		expect(out).toContain("Answer from the sources.");
		expect(out).toContain(EV);
	});
});

describe("injectSearchGroundingPrompt", () => {
	it("appends the grounding suffix after an existing preprompt", () => {
		const out = injectSearchGroundingPrompt("PERSONA", EV, ASOF);
		expect(out.startsWith("PERSONA\n\n")).toBe(true);
		expect(out).toContain(EV);
	});

	it("returns just the suffix when there is no preprompt", () => {
		const out = injectSearchGroundingPrompt(undefined, EV, ASOF);
		expect(out).toContain(EV);
		expect(out.startsWith("\n")).toBe(false);
	});
});
