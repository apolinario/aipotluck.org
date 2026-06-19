// TEMP: pre-launch tuning panel (Julie/Laura edit prompts + params without a deploy).
// Gated by requireAdmin (on top of the app-wide Basic Auth gate). Remove this whole
// routes/tuning/ dir + $lib/server/tuning.ts before public launch.
import { requireAdmin } from "$lib/server/api/utils/requireAuth";
import { getTuning, setTuning, type Tuning } from "$lib/server/tuning";
import {
	DEFAULT_PERSONA_TEMPLATE,
	GROUNDED_DECODING,
} from "$lib/server/textGeneration/persona";
import { DEFAULT_GROUNDING_TEMPLATE } from "$lib/server/textGeneration/searchGrounding";
import { suggestions } from "$lib/constants/suggestions";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return {
		current: await getTuning(),
		defaults: {
			persona: DEFAULT_PERSONA_TEMPLATE,
			grounding: DEFAULT_GROUNDING_TEMPLATE,
			decoding: GROUNDED_DECODING,
			starters: suggestions,
		},
	};
};

function num(v: FormDataEntryValue | null): number | undefined {
	const s = String(v ?? "").trim();
	if (!s) return undefined;
	const n = Number(s);
	return Number.isFinite(n) ? n : undefined;
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requireAdmin(locals);
		const fd = await request.formData();

		// Build decoding from only the provided number fields (empty = use that default).
		const decoding: NonNullable<Tuning["decoding"]> = {};
		const t = num(fd.get("temperature"));
		if (t !== undefined) decoding.temperature = t;
		const fp = num(fd.get("frequency_penalty"));
		if (fp !== undefined) decoding.frequency_penalty = fp;
		const pp = num(fd.get("presence_penalty"));
		if (pp !== undefined) decoding.presence_penalty = pp;
		const mt = num(fd.get("max_tokens"));
		if (mt !== undefined) decoding.max_tokens = mt;

		// Always include all four groups so blanking a field resets it to the code default
		// ("" / [] / {} are treated as "default" at the read sites). setTuning validates.
		const next: Tuning = {
			persona: String(fd.get("persona") ?? "").trim(),
			grounding: String(fd.get("grounding") ?? "").trim(),
			decoding,
			starters: String(fd.get("starters") ?? "")
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean),
		};

		try {
			const saved = await setTuning(next, locals.user?.username ?? "admin");
			return { saved: true, value: saved };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : "save failed" });
		}
	},
};
