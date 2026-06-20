<script lang="ts">
	import type { Message } from "$lib/types/Message";

	// Honesty chip for the conference-wifi fallback. When the time-to-first-token watchdog
	// gave up waiting for the live model (the request never reached the server) we render a
	// pre-vetted starter answer so the user isn't left staring at a dead spinner. This chip
	// makes that provenance explicit — it is NOT a fresh Apertus generation — and offers the
	// one honest action: retry for a live answer once the connection is back. It reuses the
	// existing onretry seam (same one the footer Retry button uses), no new machinery.
	//
	// Driven by the TRANSIENT message.servedFromCache marker (see Message.ts): set only on the
	// client when the watchdog falls back, never persisted, so a reloaded conversation — which
	// re-fetches live — correctly stops showing it. The provenance stays truthful on reload.
	interface Props {
		message: Message;
		onretry?: (payload: { id: Message["id"]; content?: string }) => void;
	}
	let { message, onretry }: Props = $props();
</script>

<div
	class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]"
	title="Your connection dropped before the live model could respond, so we showed a saved, pre-vetted answer instead of leaving you waiting. This is not a fresh Apertus generation — retry for a live answer once you're back online."
>
	<span class="size-[6px] shrink-0 rounded-full" style="background: var(--ap-building)"></span>
	<span>Saved answer — your connection dropped before the live model replied.</span>
	{#if onretry}
		<button
			type="button"
			class="whitespace-nowrap text-[var(--ap-building-text)] underline-offset-2 hover:underline"
			onclick={() => onretry?.({ id: message.id })}
		>
			get a live answer →
		</button>
	{/if}
</div>
