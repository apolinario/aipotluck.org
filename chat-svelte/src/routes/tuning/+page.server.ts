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
import { adminTokenManager } from "$lib/server/adminToken";
import { fail, redirect } from "@sveltejs/kit";
import { base } from "$app/paths";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	// Convenience: a single bookmarkable link — /tuning?token=<secret> grants this session
	// admin then redirects to the clean /tuning URL (keeps the secret out of the address
	// bar / history). Falls through to requireAdmin for an already-admin session.
	const token = url.searchParams.get("token");
	if (token && locals.sessionId && adminTokenManager.checkToken(token, locals.sessionId)) {
		redirect(303, `${base}/tuning`);
	}
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

// Non-blocking safety net: if an OVERRIDDEN persona/grounding no longer mentions key
// safety markers, warn (never block — Laura owns this language and may reword
// deliberately). The hard moderation gate (toxic-bert / child-safety) is separate and
// not tunable, so this is about the in-conversation guidance only.
function safetyWarnings(t: Tuning): string[] {
	const w: string[] = [];
	if (t.persona) {
		const p = t.persona.toLowerCase();
		if (!/crisis|suicide|988|helpline|findahelpline/.test(p))
			w.push("crisis / self-harm resources");
		if (!/machine|ai system|not a person|non-anthropomorphic/.test(p))
			w.push("the non-anthropomorphic voice rule");
		if (!/\{model\}|\{maker\}|identity|developed by/.test(p)) w.push("model-identity guidance");
	}
	if (t.grounding) {
		const g = t.grounding.toLowerCase();
		if (!/cite|\[1\]|\[n\]|sources/.test(g)) w.push("cite-your-sources grounding");
	}
	return w;
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
			return { saved: true, warnings: safetyWarnings(saved) };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : "save failed" });
		}
	},
};
