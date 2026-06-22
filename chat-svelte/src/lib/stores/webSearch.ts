import { browser } from "$app/environment";
import { writable } from "svelte/store";

// User preference: is open-web search ALLOWED this session?
//
// Default ON (the Feature-Lock "enabled by default"): when allowed, the per-turn margin gate
// auto-decides whether a question needs current info and searches if so. Toggle OFF ("can be
// disabled") and the turn never searches — the answer comes from training only, and the provenance
// honestly reads "from training" (an "I can't be sure this is current" hedge is then CORRECT, and
// hedgeGuard leaves it alone because the turn isn't grounded).
//
// Deliberately a lightweight client-only preference persisted in localStorage — NOT a server-synced
// Settings field (no schema/endpoint round-trip for a per-device toggle).
const KEY = "ap:webSearchAllowed";

function initial(): boolean {
	if (!browser) return true;
	try {
		return localStorage.getItem(KEY) !== "0"; // default true unless explicitly disabled
	} catch {
		return true;
	}
}

export const webSearchAllowed = writable<boolean>(initial());

if (browser) {
	webSearchAllowed.subscribe((v) => {
		try {
			localStorage.setItem(KEY, v ? "1" : "0");
		} catch {
			/* private mode / quota — preference just won't persist */
		}
	});
}
