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

	// Second-opinion provenance: set when the user requested an independent take from a
	// more-capable open model (a real, user-initiated routing event). Persisted via JSONB
	// so the comparison + the routing map event survive reload, mirroring webSearch above.
	secondOpinion?: {
		model: string;
		modelShort: string;
		openness: string;
		sovereign: boolean;
		answer: string;
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
