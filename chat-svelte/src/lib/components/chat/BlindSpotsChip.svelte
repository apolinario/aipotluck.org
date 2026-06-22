<script lang="ts">
	import { blindSpotsOpen } from "$lib/stores/blindSpots";

	// Empty-state launcher for the canonical Blind Spots disclosure (BlindSpotsModal, mounted once
	// at the ChatWindow root). It surfaces the honest known-weaknesses prominently at first
	// impression — the anti-false-certainty counterweight to the "We are …" commitments above —
	// where a first-time user (or a journalist pressure-testing the demo) decides whether to trust
	// the thing. The composer-footer "Blind spots" link opens the same modal but is one of six tiny
	// footer items; this is the prominent entry point. NO copy lives here: the modal is the single
	// source of truth for the weakness wording. Removable in isolation (this component + its mount
	// in ChatIntroduction.svelte).
</script>

<button
	type="button"
	class="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--ap-ink-3)] uppercase opacity-70 transition-opacity hover:opacity-100"
	onclick={() => blindSpotsOpen.set(true)}
>
	<span>Where I'm weak</span>
	<span class="text-[8px]">↗</span>
</button>
