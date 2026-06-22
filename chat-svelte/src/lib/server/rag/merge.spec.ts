import { describe, it, expect } from "vitest";
import { mergeRagEvidence } from "./index";
import { cosine } from "./embed";
import { parseEpflDocContent } from "./syftEpfl";
import type { RagSource } from "$lib/types/Rag";

const hit = (over: Partial<Omit<RagSource, "n">>): Omit<RagSource, "n"> => ({
	title: "T",
	snippet: "S",
	engine: "Potluck",
	...over,
});

describe("mergeRagEvidence", () => {
	it("numbers sources sequentially and renders a citable evidence block", () => {
		const ctx = mergeRagEvidence(
			"q",
			[
				hit({ title: "Cloud Compute", snippet: "GPU services." }),
				hit({
					title: "EPFL launches LLMs",
					snippet: "Meditron.",
					engine: "SyftHub:EPFL",
					url: "https://x",
				}),
			],
			undefined
		);
		expect(ctx.sources.map((s) => s.n)).toEqual([1, 2]);
		expect(ctx.evidence).toContain("[1] Cloud Compute (Potluck)");
		expect(ctx.evidence).toContain("[2] EPFL launches LLMs (SyftHub:EPFL)");
		expect(ctx.evidence).toContain("https://x");
		expect(ctx.vaultSynthesis).toBeUndefined();
	});

	it("keeps vault synthesis separate from numbered sources", () => {
		const ctx = mergeRagEvidence("q", [], "Charlie Chaplin lived in Vevey.");
		expect(ctx.sources).toHaveLength(0);
		expect(ctx.evidence).toBe("");
		expect(ctx.vaultSynthesis).toBe("Charlie Chaplin lived in Vevey.");
	});
});

describe("cosine", () => {
	it("is 1 for identical vectors and 0 for orthogonal/mismatched", () => {
		expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
		expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
		expect(cosine([1, 2, 3], [1, 2])).toBe(0); // length mismatch → 0
	});
});

describe("parseEpflDocContent", () => {
	it("extracts title/url and strips HTML from a JSON article", () => {
		const content = JSON.stringify({
			title: "EPFL launches open medical LLMs",
			subtitle: "<p>MeditronFO is the first fully open framework.</p>",
			url: "https://actu.epfl.ch/news/x",
		});
		const [src] = parseEpflDocContent(content);
		expect(src.title).toBe("EPFL launches open medical LLMs");
		expect(src.url).toBe("https://actu.epfl.ch/news/x");
		expect(src.snippet).not.toContain("<p>");
		expect(src.snippet).toContain("MeditronFO");
	});

	it("expands a JSON array of articles into multiple sources", () => {
		const content = JSON.stringify([
			{ title: "A", text_snippet: "first" },
			{ title: "B", text_snippet: "second" },
		]);
		expect(parseEpflDocContent(content)).toHaveLength(2);
	});

	it("falls back to raw text when content is not JSON", () => {
		const [src] = parseEpflDocContent("just a plain string");
		expect(src.snippet).toBe("just a plain string");
	});
});
