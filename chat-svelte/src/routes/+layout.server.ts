import { config } from "$lib/server/config";
import { defaultModel } from "$lib/server/models";
import { resolveServing } from "$lib/servingProvenance";

// Derive serving provenance ONCE, server-side, from the actual inference config
// (base URL + served checkpoint) and ship only the honest labels to the client.
// The raw OPENAI_BASE_URL stays server-side; the map/greeting consume the result
// via `page.data.servingProvenance`. Merges with the universal `+layout.ts` load.
export const load = async () => {
	return {
		servingProvenance: resolveServing(config.OPENAI_BASE_URL, defaultModel?.id),
	};
};
