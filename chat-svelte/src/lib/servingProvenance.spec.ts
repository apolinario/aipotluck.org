import { describe, it, expect } from "vitest";
import { resolveServing } from "./servingProvenance";

describe("resolveServing", () => {
	const HF = "https://router.huggingface.co/v1";
	const CSCS = "https://api.swissai.svc.cscs.ch/v1";

	it("labels the HF router as a non-sovereign prototype host", () => {
		const s = resolveServing(HF, "swiss-ai/Apertus-70B-Instruct-2509");
		expect(s.providerLabel).toBe("HuggingFace");
		expect(s.isSovereign).toBe(false);
		expect(s.servedCheckpoint).toBe("Apertus-70B-Instruct-2509");
		// HF copy keeps the prototype-vs-production hedge.
		expect(s.heroServingLine).toMatch(/served via HuggingFace/i);
		expect(s.mapHeaderLine).toMatch(/served via HuggingFace/i);
		expect(s.cscsServingNote).toMatch(/not yet from CSCS/i);
		expect(s.routingProvider).toMatch(/HuggingFace/);
	});

	it("labels CSCS direct as sovereign and drops the prototype hedge", () => {
		const s = resolveServing(CSCS, "swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo");
		expect(s.providerLabel).toBe("CSCS");
		expect(s.isSovereign).toBe(true);
		expect(s.servedCheckpoint).toBe("Apertus-1.5-8B-Instruct-sft-dpo");
		// Sovereign copy says it runs on CSCS now; no "not yet" / "via HuggingFace".
		expect(s.heroServingLine).toMatch(/sovereign public compute at CSCS/i);
		expect(s.heroServingLine).not.toMatch(/HuggingFace/i);
		expect(s.cscsServingNote).toMatch(/now serves this prototype directly/i);
		expect(s.cscsServingNote).not.toMatch(/not yet/i);
	});

	it("derives the HF model page from the served id", () => {
		expect(resolveServing(CSCS, "swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo").checkpointUrl).toBe(
			"https://huggingface.co/swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo"
		);
	});

	it("fails honest on an unknown host: no invented provider, treated as non-sovereign", () => {
		const s = resolveServing("https://example.com/v1", "some/model");
		expect(s.providerLabel).toBe("example.com");
		expect(s.isSovereign).toBe(false);
		expect(s.heroServingLine).toMatch(/served via example\.com/i);
	});

	it("degrades gracefully with no base URL or model id", () => {
		const s = resolveServing(undefined, undefined);
		expect(s.providerLabel).toBe("the configured endpoint");
		expect(s.isSovereign).toBe(false);
		expect(s.servedCheckpoint).toBe("the configured model");
	});
});
