import type { Message } from "$lib/types/Message";
import type { SearchContext } from "$lib/types/Search";
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
