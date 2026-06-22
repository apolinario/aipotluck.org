import type { InferenceProvider } from "@huggingface/inference";
import type { MessageUpdate, ModerationKind } from "./MessageUpdate";
import type { Timestamps } from "./Timestamps";
import type { SearchSource } from "./Search";
import type { v4 } from "uuid";

export type Message = Partial<Timestamps> & {
	from: "user" | "assistant" | "system";
	id: ReturnType<typeof v4>;
	content: string;
	updates?: MessageUpdate[];

	// Optional server or client-side reasoning content (<think> blocks)
	reasoning?: string;
	score?: -1 | 0 | 1;
	/**
	 * Either contains the base64 encoded image data
	 * or the hash of the file stored on the server
	 **/
	files?: MessageFile[];
	interrupted?: boolean;

	// TRANSIENT, client-render-only — deliberately NOT persisted (no JSONB column).
	// Set when the time-to-first-token watchdog fell back to a pre-vetted starter
	// answer because the live request never reached the server (conference-wifi
	// request-lost-before-egress). Drives an honesty chip in ChatMessage. It must
	// stay transient: a reloaded conversation re-fetches live and is no longer
	// cache-served, so persisting it would misreport provenance on reload.
	servedFromCache?: boolean;

	// Router metadata when using llm-router
	routerMetadata?: {
		route: string;
		model: string;
		provider?: InferenceProvider;
	};

	// Open-web search provenance: when the user grounded this answer on an open
	// search, the numbered sources the model was told to cite. Persisted via JSONB
	// so the citations strip + map highlight survive reload. `evidence` (the raw
	// grounding block) is server-only and deliberately NOT stored here.
	webSearch?: {
		query: string;
		sources: SearchSource[];
		asOf: string;
	};

	// Safety provenance: set when the proactive pre-screen (toxic-bert / child-safety)
	// declined this turn BEFORE the model ran. Its presence makes the answer render as a
	// safety decline — the "Apertus" provenance badge is suppressed (the model never ran)
	// and the live-stack map highlights the toxic-bert node instead. Persisted via JSONB so
	// the decline survives reload, mirroring webSearch above.
	moderation?: {
		flagged: boolean;
		label: string | null;
		score: number;
		kind: ModerationKind;
	};

	// Name-adoption correction: set when the post-generation guard ($lib/server/nameGuard) detected
	// the model adopted a personal name for itself this turn. Its presence renders an honest "this
	// system has no name" chip beside the answer, and the strip neutralizes the name in later context
	// so it can't compound into a named companion over a session. Persisted via JSONB so the
	// correction survives reload, mirroring moderation/webSearch above.
	nameNotice?: {
		name?: string;
	};

	// Independent cross-checks the user opted into, in the order they were requested
	// (second opinion, then third, …). Each is ANOTHER open model's take on the same
	// question — neutral triangulation so the user can compare, never a synthesized
	// consensus or an oracle. Convergence across independent labs is more trustworthy;
	// divergence is worth scrutiny. Persisted via JSONB so the comparison + the routing
	// map events survive reload, mirroring webSearch above.
	opinions?: {
		model: string;
		modelShort: string;
		openness: string;
		sovereign: boolean;
		answer: string;
	}[];

	// Collective cross-check verdict over the panel of independent opinions (above) AS A
	// JUDGMENT ON the primary answer — never a merged/synthesized answer of its own. The
	// fanout VERIFIES the answer already given; it does not replace it. `agreement` is the
	// honest calibrated confidence signal (cross-model agreement is the only per-answer
	// confidence we can measure); `headline` is its one-line surfacing. consensus /
	// contradictions / blindSpots mirror the open Fusion-style analysis (we deliberately
	// stop before any synthesis step). Persisted via JSONB alongside opinions[].
	verdict?: {
		agreement: "high" | "mixed" | "low";
		headline: string;
		consensus: string[];
		contradictions: string[];
		blindSpots: string[];
	};

	// needed for conversation trees
	ancestors?: Message["id"][];

	// goes one level deep
	children?: Message["id"][];
};

export type MessageFile = {
	type: "hash" | "base64";
	name: string;
	value: string;
	mime: string;
};
