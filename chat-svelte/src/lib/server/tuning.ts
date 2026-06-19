// TEMP: pre-launch tuning panel — lets Julie/Laura edit Gap Chat prompts + decoding
// params + starter prompts via /admin/tuning WITHOUT a deploy. Stored as a single
// "TUNING" row in the EXISTING `config` table (no new schema). Every field is optional;
// read sites use `override ?? code-default`, so a missing/invalid row — or deleting the
// whole panel — reverts to the hardcoded behavior.
//
// REMOVE BEFORE PUBLIC LAUNCH: delete this file + src/routes/admin/tuning/, drop the
// TUNING config row, and the `?? default` read sites collapse back to the constants.
import { z } from "zod";
import { collections } from "$lib/server/database";
import { logger } from "$lib/server/logger";

const DecodingSchema = z
	.object({
		temperature: z.number().min(0).max(2),
		frequency_penalty: z.number().min(-2).max(2),
		presence_penalty: z.number().min(-2).max(2),
		max_tokens: z.number().int().min(1).max(4096),
	})
	.partial();

// All optional: absence of a field = use the code default at the read site.
export const TuningSchema = z
	.object({
		persona: z.string().max(20000),
		grounding: z.string().max(20000),
		decoding: DecodingSchema,
		starters: z.array(z.string().min(1).max(2000)).max(8),
		editedBy: z.string().max(200),
		editedAt: z.string().max(40),
	})
	.partial();

export type Tuning = z.infer<typeof TuningSchema>;

const KEY = "TUNING";
const TTL_MS = 20_000;
let cache: { at: number; value: Tuning } | null = null;

/** Parse a raw stored doc into Tuning; invalid input fails safe to {} (→ code defaults).
 *  Unknown keys (e.g. the row's `key`) are stripped by the schema. Pure; unit-tested. */
export function parseTuning(raw: unknown): Tuning {
	const parsed = TuningSchema.safeParse(raw ?? {});
	return parsed.success ? parsed.data : {};
}

// The config collection is typed to ConfigKey (env keys); TUNING is our own row, so a
// narrow structural cast is used for read/write. Kept local to this temp module.
type ConfigRowStore = {
	findOne(filter: { key: string }): Promise<Record<string, unknown> | null>;
	updateOne(
		filter: { key: string },
		update: { $set: Record<string, unknown> },
		opts: { upsert: boolean }
	): Promise<unknown>;
};
function configStore(): ConfigRowStore {
	return collections.config as unknown as ConfigRowStore;
}

/** Current tuning overrides (cached ~20s). Fails safe to {} on any read/parse error so a
 *  broken row can never take down the chat. */
export async function getTuning(): Promise<Tuning> {
	if (cache && Date.now() - cache.at < TTL_MS) {
		return cache.value;
	}
	let value: Tuning = {};
	try {
		const row = await configStore().findOne({ key: KEY });
		value = parseTuning(row);
	} catch (e) {
		logger.warn(e, "[tuning] read failed; using code defaults");
	}
	cache = { at: Date.now(), value };
	return value;
}

/** REPLACE the stored doc with a validated `next` (the admin form submits the full desired
 *  state, so an omitted field means "use the code default" — replace, not merge). Stamps
 *  editor + time, upserts, busts cache. */
export async function setTuning(next: Tuning, editedBy: string): Promise<Tuning> {
	const validated = parseTuning({ ...next, editedBy, editedAt: new Date().toISOString() });
	await configStore().updateOne({ key: KEY }, { $set: validated }, { upsert: true });
	cache = { at: Date.now(), value: validated };
	return validated;
}

export function bustTuningCache(): void {
	cache = null;
}
