import { describe, expect, it } from "vitest";
import { applyOverrides, selectAllowedModels, toModelConfigs } from "./modelsCatalog";
import type { CatalogEntry, ModelConfig, ModelOverride } from "./models";

// Minimal CatalogEntry fixtures. The shape mirrors the upstream /models payload (id required, the
// rest nullish), so plain objects suffice — the registry-side schema parse happens before this layer.
const entry = (id: string, extra: Partial<CatalogEntry> = {}): CatalogEntry =>
	({ id, ...extra }) as CatalogEntry;

describe("selectAllowedModels", () => {
	const data = [entry("swiss-ai/Apertus-70B"), entry("meta/llama-3"), entry("mistral/large")];

	it("returns the full catalog for the wildcard specs", () => {
		expect(selectAllowedModels(data, "*")).toBe(data);
		expect(selectAllowedModels(data, "all")).toBe(data);
		expect(selectAllowedModels(data, "ALL")).toBe(data);
	});

	it("returns the full catalog when the spec is empty/whitespace", () => {
		expect(selectAllowedModels(data, "")).toBe(data);
		expect(selectAllowedModels(data, "   ")).toBe(data);
	});

	it("keeps only allowlisted ids", () => {
		const result = selectAllowedModels(data, "mistral/large");
		expect(result.map((m) => m.id)).toEqual(["mistral/large"]);
	});

	it("orders by the allowlist, not the upstream catalog order (first → defaultModel)", () => {
		const result = selectAllowedModels(data, "mistral/large, swiss-ai/Apertus-70B");
		expect(result.map((m) => m.id)).toEqual(["mistral/large", "swiss-ai/Apertus-70B"]);
	});

	it("ignores allowlisted ids the catalog does not contain", () => {
		const result = selectAllowedModels(data, "meta/llama-3, ghost/model");
		expect(result.map((m) => m.id)).toEqual(["meta/llama-3"]);
	});

	it("falls back to the full catalog when the allowlist matches nothing", () => {
		const result = selectAllowedModels(data, "ghost/one, ghost/two");
		expect(result).toBe(data);
	});
});

describe("toModelConfigs", () => {
	const opts = { baseURL: "https://api.example/v1", isHFRouter: true, multimodalEnabled: false };

	it("derives the HF org avatar logo for a slashed id on the HF router", () => {
		const [m] = toModelConfigs([entry("swiss-ai/Apertus-70B")], opts);
		expect(m.logoUrl).toBe("https://huggingface.co/api/avatars/swiss-ai");
	});

	it("does not derive a logo when not on the HF router", () => {
		const [m] = toModelConfigs([entry("swiss-ai/Apertus-70B")], { ...opts, isHFRouter: false });
		expect(m.logoUrl).toBeUndefined();
	});

	it("does not derive a logo for an unslashed id", () => {
		const [m] = toModelConfigs([entry("gpt-foo")], opts);
		expect(m.logoUrl).toBeUndefined();
	});

	it("forces non-multimodal when multimodal is gated off, even if the model advertises vision", () => {
		const [m] = toModelConfigs(
			[
				entry("x/y", {
					architecture: { input_modalities: ["text", "Image"] },
				} as Partial<CatalogEntry>),
			],
			opts
		);
		expect(m.multimodal).toBe(false);
		expect(m.multimodalAcceptedMimetypes).toBeUndefined();
	});

	it("enables multimodal when gated on and the model accepts image/vision input", () => {
		const [m] = toModelConfigs(
			[
				entry("x/y", {
					architecture: { input_modalities: ["text", "vision"] },
				} as Partial<CatalogEntry>),
			],
			{ ...opts, multimodalEnabled: true }
		);
		expect(m.multimodal).toBe(true);
		expect(m.multimodalAcceptedMimetypes).toEqual(["image/*"]);
	});

	it("aggregates tool support across providers", () => {
		const withTools = toModelConfigs(
			[entry("x/y", { providers: [{ supports_tools: false }, { supports_tools: true }] })],
			opts
		);
		const noTools = toModelConfigs(
			[entry("x/y", { providers: [{ supports_tools: false }] })],
			opts
		);
		expect(withTools[0].supportsTools).toBe(true);
		expect(noTools[0].supportsTools).toBe(false);
	});

	it("carries the baseURL onto an openai endpoint", () => {
		const [m] = toModelConfigs([entry("x/y")], opts);
		expect(m.endpoints?.[0]).toMatchObject({ type: "openai", baseURL: "https://api.example/v1" });
	});
});

describe("applyOverrides", () => {
	const base: ModelConfig[] = [
		{ id: "a/one", name: "a/one" } as ModelConfig,
		{ id: "b/two", name: "b/two" } as ModelConfig,
	];

	it("returns the configs untouched when there are no overrides", () => {
		expect(applyOverrides(base, [])).toBe(base);
	});

	it("merges an override matched by id and strips the id/name selectors", () => {
		const overrides = [{ id: "a/one", supportsArtifacts: true } as ModelOverride];
		const result = applyOverrides(base, overrides);
		expect(result[0]).toMatchObject({ id: "a/one", name: "a/one", supportsArtifacts: true });
		// untouched entry passes through by reference
		expect(result[1]).toBe(base[1]);
	});

	it("matches by name when the id does not match", () => {
		const overrides = [{ name: "b/two", description: "overridden" } as ModelOverride];
		const result = applyOverrides(base, overrides);
		expect(result[1]).toMatchObject({ id: "b/two", description: "overridden" });
	});

	it("leaves a config untouched when no override targets it", () => {
		const overrides = [{ id: "c/three", description: "nope" } as ModelOverride];
		const result = applyOverrides(base, overrides);
		expect(result[0]).toBe(base[0]);
		expect(result[1]).toBe(base[1]);
	});
});
