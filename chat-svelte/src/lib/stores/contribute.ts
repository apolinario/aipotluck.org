import { writable } from "svelte/store";

// Open-state for the single, top-level ContributeDialog. The dialog is mounted ONCE at the
// ChatWindow root (not nested inside the welcome overlay), so its Modal's backdrop intro
// transition plays normally — nesting it inside the welcome overlay's stacking/inert subtree
// left the `fade` backdrop stuck at opacity 0 (whole modal rendered translucent). Any CTA
// (the welcome overlay's "How to contribute", a header/footer trigger) just flips this.
export const contributeOpen = writable(false);
