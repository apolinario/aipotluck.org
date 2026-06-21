// Pure catalog-shaping transforms for the model registry.
//
// These are the side-effect-free phases of models.ts's buildModels(): constrain the upstream
// /models catalog to the curated allowlist, shape the survivors into model configs, and layer
// MODELS overrides on top. They live here (separate from models.ts, which network-fetches the
// catalog at module load) so they can be unit-tested without booting the live registry. The
// type-only import from models.ts is erased at build time, so importing this module has no
// runtime dependency on the registry and triggers no fetch.

import { logger } from "$lib/server/logger";
import type { CatalogEntry, ModelConfig, ModelOverride } from "$lib/server/models";

// Constrain the upstream router's full catalog to a curated allowlist. `allowlistSpec` is the
// resolved policy string: "*"/"all" → full catalog; a comma-separated id list → just those ids,
// reordered to the allowlist order; empty → full catalog (the caller defaults it to Apertus 70B).
export function selectAllowedModels(data: CatalogEntry[], allowlistSpec: string): CatalogEntry[] {
	const exposeAll = ["*", "all"].includes(allowlistSpec.toLowerCase());
	const allowlist = allowlistSpec
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const allowSet = new Set(allowlist);
	if (exposeAll || !allowSet.size) {
		return data;
	}

	// Order by the allowlist, not the upstream router catalog order, so the FIRST allowlisted id
	// deterministically becomes defaultModel (models[0]) downstream.
	const byId = new Map(data.map((m) => [m.id, m]));
	const filtered = allowlist.map((id) => byId.get(id)).filter((m): m is CatalogEntry => Boolean(m));
	if (filtered.length) {
		logger.info(
			{ kept: filtered.length, of: data.length },
			"[models] Constrained to model allowlist"
		);
		return filtered;
	}
	logger.warn({ allowlist }, "[models] Allowlist matched nothing; using full catalog");
	return data;
}

export interface ToModelConfigsOptions {
	baseURL: string;
	isHFRouter: boolean;
	multimodalEnabled: boolean;
}

// Shape catalog entries into ModelConfigs: derive the HF org logo, normalize input modalities to a
// text-only-gated multimodal flag, and aggregate per-provider tool support.
export function toModelConfigs(
	data: CatalogEntry[],
	{ baseURL, isHFRouter, multimodalEnabled }: ToModelConfigsOptions
): ModelConfig[] {
	return data.map((m) => {
		let logoUrl: string | undefined = undefined;
		if (isHFRouter && m.id.includes("/")) {
			const org = m.id.split("/")[0];
			logoUrl = `https://huggingface.co/api/avatars/${encodeURIComponent(org)}`;
		}

		const inputModalities = (m.architecture?.input_modalities ?? []).map((modality) =>
			modality.toLowerCase()
		);
		const supportsImageInput =
			inputModalities.includes("image") || inputModalities.includes("vision");

		// If any provider supports tools, consider the model as supporting tools
		const supportsTools = Boolean((m.providers ?? []).some((p) => p?.supports_tools === true));
		return {
			id: m.id,
			name: m.id,
			displayName: m.id,
			description: m.description,
			logoUrl,
			providers: m.providers,
			// TEXT-ONLY ALPHA: force non-multimodal regardless of what the served model advertises,
			// so the client never shows the image-attach affordance and no image is sent. Gated —
			// flip MULTIMODAL_ENABLED post-July. See $lib/server/textOnly.
			multimodal: multimodalEnabled && supportsImageInput,
			multimodalAcceptedMimetypes:
				multimodalEnabled && supportsImageInput ? ["image/*"] : undefined,
			supportsTools,
			endpoints: [
				{
					type: "openai" as const,
					baseURL,
					// apiKey will be taken from OPENAI_API_KEY or HF_TOKEN automatically
				},
			],
		} as ModelConfig;
	}) as ModelConfig[];
}

// Layer MODELS overrides (matched by id or name) onto the shaped configs. The override's own
// id/name keys are stripped before merge — they're match selectors, not values to overwrite with.
export function applyOverrides(configs: ModelConfig[], overrides: ModelOverride[]): ModelConfig[] {
	if (!overrides.length) {
		return configs;
	}

	const overrideMap = new Map<string, ModelOverride>();
	for (const override of overrides) {
		for (const key of [override.id, override.name]) {
			const trimmed = key?.trim();
			if (trimmed) overrideMap.set(trimmed, override);
		}
	}

	return configs.map((model) => {
		const override = overrideMap.get(model.id ?? "") ?? overrideMap.get(model.name ?? "");
		if (!override) return model;

		const { id, name, ...rest } = override;
		void id;
		void name;

		return {
			...model,
			...rest,
		};
	});
}
