import type { Message } from "$lib/types/Message";
import type { SearchContext } from "$lib/types/Search";
import type { RagContext } from "$lib/types/Rag";
import type { MessageRagUpdate } from "$lib/types/MessageUpdate";
import type { ModerationKind } from "$lib/types/MessageUpdate";

// SINGLE source of truth for the provenance markers stamped onto an assistant
// message. By construction these markers are written in TWO places: the server
// (authoritative, persisted to the DB) and the client (optimistic, so the
// citations strip / safety decline / map pulse appear LIVE during streaming, not
// only after the post-stream reload re-hydrates from the DB). Those two paths used
// to each inline the same object literal — a classic inline behavioral twin that
// silently drifts as we add provenance fields. They are collapsed here so the
// marker SHAPE has one authority. (This is the "collapse to a single path" fix a
// drift nose like calque points at, rather than policing two copies with a test.)
//
// What stays at the call sites on purpose: the DECISIONS (did a search run? did the
// safety pre-screen flag this, as toxicity or child-safety?). Only the shape of the
// resulting marker is shared — the safety/report seam logic is untouched so its 1:1
// parity with the downstream port is preserved.

// Web-search provenance: the numbered open sources the answer was told to cite.
// `evidence` (the raw grounding block) is deliberately dropped — it feeds the model,
// never persistence. Returns undefined when nothing grounded the turn, so the "only
// stamp when there are sources" contract lives in one place (callers just assign the
// result when truthy). The honest invariant downstream UI relies on: webSearch is
// present IFF sources.length > 0.
export function searchProvenance(
	searchContext: SearchContext | undefined | null
): NonNullable<Message["webSearch"]> | undefined {
	if (!searchContext?.sources.length) return undefined;
	return {
		query: searchContext.query,
		sources: searchContext.sources,
		asOf: searchContext.asOf,
	};
}

// RAG-store provenance: catalog + federated sources the answer was told to cite, plus
// optional vault synthesis (attributed separately). `evidence` is deliberately dropped.
// Returns undefined when nothing grounded the turn. The honest invariant: rag is present
// IFF sources.length > 0 OR vaultSynthesis is non-empty.
export function ragProvenance(
	rag: RagContext | MessageRagUpdate | null | undefined
): NonNullable<Message["rag"]> | undefined {
	if (!rag) return undefined;
	const hasSources = (rag.sources?.length ?? 0) > 0;
	const hasVault = Boolean(rag.vaultSynthesis?.trim());
	if (!hasSources && !hasVault) return undefined;
	return {
		query: rag.query,
		sources: rag.sources ?? [],
		asOf: rag.asOf,
		vaultSynthesis: rag.vaultSynthesis,
	};
}

// Read-side provenance gate for the conference-wifi fallback. A turn served from the
// pre-vetted starter cache (message.servedFromCache — set only when the time-to-first-token
// watchdog gave up because the live request never reached the server) did NOT run the live
// pipeline. So the inline provenance trace, which would otherwise assert "Apertus generated
// this" / "grounded on N sources" / "verified by a second model", MUST be suppressed and
// replaced by the honest CacheNotice. These two predicates are mutually exclusive by
// construction for any assistant message, so the UI can never simultaneously claim BOTH
// "served from a saved answer" AND "freshly generated live" — the core honesty invariant.
// Both false for user/system turns (neither surface belongs on them).
export function showsLiveProvenanceTrace(
	message: Pick<Message, "from" | "servedFromCache">
): boolean {
	return message.from === "assistant" && !message.servedFromCache;
}

export function showsCacheNotice(message: Pick<Message, "from" | "servedFromCache">): boolean {
	return message.from === "assistant" && Boolean(message.servedFromCache);
}

// Safety-decline marker: stamped when the pre-screen declined a turn before the
// model ran. The decision (toxic-bert toxicity vs child-safety) is made upstream and
// differs per call site — the server computes it; the client reads it off the emitted
// Safety update — so this factory takes the already-decided fields. `flagged` is
// hardcoded true: a moderation marker only ever exists on a decline, and pinning it
// here removes a drift vector (no call site can stamp a marker with flagged:false).
export function moderationMarker(fields: {
	label: string | null;
	score: number;
	kind: ModerationKind;
}): NonNullable<Message["moderation"]> {
	return {
		flagged: true,
		label: fields.label,
		score: fields.score,
		kind: fields.kind,
	};
}
