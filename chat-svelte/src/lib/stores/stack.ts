import { writable } from "svelte/store";

// Open-state for the "behind the scenes" live-stack map. The map is HIDDEN BY DEFAULT on
// BOTH desktop and mobile — the answer is primary and the inline provenance trace already
// carries the receipt. The map is the deepest layer, revealed on demand from a single
// surface: the per-answer trace's "behind the scenes ↗" tail link (and the welcome
// "see how it's built"). One store drives one responsive overlay — a right-side drawer on
// desktop, a bottom sheet on mobile — so there is no desktop-split / mobile-tab fork to
// maintain. `false` = closed. The map component stays MOUNTED while closed (the overlay
// just slides it off-screen) so its `ap:flash` / `ap:pulse-*` listeners stay live and a
// reveal-and-flash lands on an already-listening map.
export const stackOpen = writable<boolean>(false);
