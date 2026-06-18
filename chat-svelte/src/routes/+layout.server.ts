import { config } from "$lib/server/config";
import { defaultModel } from "$lib/server/models";
import { resolveServing } from "$lib/servingProvenance";
import { resolveTriggerStrategy } from "$lib/search/triggerStrategy";

// Derive serving provenance ONCE, server-side, from the actual inference config
// (base URL + served checkpoint) and ship only the honest labels to the client.
// The raw OPENAI_BASE_URL stays server-side; the map/greeting consume the result
// via `page.data.servingProvenance`. Merges with the universal `+layout.ts` load.
// Also resolve the active search-trigger strategy from PUBLIC_SEARCH_TRIGGER so
// the client decides searches the same way the server endpoint does.
export const load = async () => {
	return {
		servingProvenance: resolveServing(config.OPENAI_BASE_URL, defaultModel?.id),
		searchTriggerStrategy: resolveTriggerStrategy(config.PUBLIC_SEARCH_TRIGGER),
	};
};
