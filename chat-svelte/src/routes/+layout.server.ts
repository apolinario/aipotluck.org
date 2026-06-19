import { config } from "$lib/server/config";
import { defaultModel } from "$lib/server/models";
import { resolveServing } from "$lib/servingProvenance";
import { resolveTriggerStrategy } from "$lib/search/triggerStrategy";
import { getTuning } from "$lib/server/tuning";

// Derive serving provenance ONCE, server-side, from the actual inference config
// (base URL + served checkpoint) and ship only the honest labels to the client.
// The raw OPENAI_BASE_URL stays server-side; the map/greeting consume the result
// via `page.data.servingProvenance`. Merges with the universal `+layout.ts` load.
// Also resolve the active search-trigger strategy from PUBLIC_SEARCH_TRIGGER so
// the client decides searches the same way the server endpoint does.
export const load = async () => {
	// TEMP (tuning panel): operator-overridden starters, else null → client uses the
	// suggestions.ts defaults. Empty list also means "use default".
	const tuningStarters = (await getTuning()).starters;
	return {
		servingProvenance: resolveServing(config.OPENAI_BASE_URL, defaultModel?.id),
		// Reflect.get: PUBLIC_SEARCH_TRIGGER isn't in committed .env, so direct config.X
		// access fails svelte-check wherever the key is unset (CI). See rerank.ts.
		searchTriggerStrategy: resolveTriggerStrategy(
			Reflect.get(config, "PUBLIC_SEARCH_TRIGGER") as string | undefined
		),
		starters: tuningStarters?.length ? tuningStarters : null,
	};
};
