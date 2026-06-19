import { writable } from "svelte/store";

// Open-state for the single, top-level BlindSpotsModal — the honest "where this system is
// systematically weak" disclosure (recency, language skew, not-advice, can-be-wrong). Mounted
// ONCE at the ChatWindow root next to ContributeDialog so its Modal backdrop intro plays; the
// footer "Blind spots" link (and any other surface) just flips this. `false` = closed.
export const blindSpotsOpen = writable<boolean>(false);
