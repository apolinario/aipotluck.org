// RAG orchestration — the single entry point the chat flow calls per turn.
//
//   maybeRagGrounding(query, locals):
//     gate on RAG_ENABLED → route to stores (decideRagSources) → fetch the
//     selected stores in parallel → merge into one grounding context.
//
// FAIL-OPEN everywhere: the feature is additive. Disabled, no store selected, or
// every store failing → null, and the chat answers normally. The local catalog
// store needs only the committed index; the EPFL + vault stores need a SyftHub
// token (see ./env). Server-side, like the MCP path — not client-triggered like
// open-web search.

import type { RagContext, RagSource } from "$lib/types/Rag";
import { ragEnabled } from "./env";
import { decideRagSources } from "./router";
import { queryLocalStore, localStoreReady } from "./localStore";
import { queryEpfl } from "./syftEpfl";
import { queryVault } from "./syftVault";
import { logger } from "$lib/server/logger";

/** Resolve a promise to a fallback if it doesn't settle in time. Keeps one slow
 *  store from blocking the turn (the SDK's own timeout is much longer). */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
	return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** Number the citable sources and render the evidence block injected into the prompt. */
export function mergeRagEvidence(
	query: string,
	hits: Omit<RagSource, "n">[],
	vaultSynthesis: string | undefined
): RagContext {
	const sources: RagSource[] = hits.map((h, i) => ({ ...h, n: i + 1 }));
	const evidence = sources
		.map((s) => `[${s.n}] ${s.title} (${s.engine})\n${s.snippet}${s.url ? `\n${s.url}` : ""}`)
		.join("\n\n");
	return {
		query,
		sources,
		evidence,
		asOf: new Date().toISOString(),
		vaultSynthesis: vaultSynthesis || undefined,
	};
}

/** Run the selected RAG stores for this turn and merge them; null to answer normally. */
export async function maybeRagGrounding(
	query: string | undefined,
	locals: App.Locals | undefined
): Promise<RagContext | null> {
	const q = (query ?? "").trim();
	if (!ragEnabled() || q.length < 3) {
		return null;
	}

	let selection;
	try {
		selection = await decideRagSources(q, locals);
	} catch (e) {
		logger.warn(e, "[rag] routing failed; answering without RAG grounding");
		return null;
	}

	const userEmail = locals?.user?.email ?? "";

	const localP =
		selection.local && localStoreReady()
			? withTimeout(queryLocalStore(q), 8000, [] as Omit<RagSource, "n">[])
			: Promise.resolve([] as Omit<RagSource, "n">[]);
	const epflP = selection.epfl
		? withTimeout(queryEpfl(q, userEmail), 9000, [] as Omit<RagSource, "n">[])
		: Promise.resolve([] as Omit<RagSource, "n">[]);
	const vaultP = selection.vault
		? withTimeout(queryVault(q), 12000, null as string | null)
		: Promise.resolve(null as string | null);

	const [local, epfl, vault] = await Promise.all([localP, epflP, vaultP]);

	const hits = [...local, ...epfl];
	if (hits.length === 0 && !vault) {
		return null;
	}
	return mergeRagEvidence(q, hits, vault ?? undefined);
}
