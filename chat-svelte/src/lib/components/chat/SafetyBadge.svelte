<script lang="ts">
	import type { ModerationKind } from "$lib/types/MessageUpdate";
	import { SAFETY_NODES } from "../stack/reveal";

	// The honest provenance line for a SAFETY DECLINE — shown in place of ProvenanceBadge
	// when a turn was stopped by the pre-screen before the model ran. The whole product
	// rests on honest provenance, so a declined message must NOT claim Apertus generated it:
	// it names the open safety classifier that actually made the call. "show on map ↗"
	// flashes the toxic-bert node so the chat event mirrors in the live stack.
	interface Props {
		kind?: ModerationKind;
		label?: string | null;
		// When rendered inside ProvenanceTrace, the trace draws the spine node, so the
		// badge suppresses its own leading dot to avoid a doubled marker.
		traced?: boolean;
	}
	let { kind = "toxicity", label, traced = false }: Props = $props();

	let source = $derived(
		kind === "child_safety"
			? "child-safety classifier"
			: "toxic-bert · Unitary · open safety classifier"
	);

	const flashSafety = () =>
		window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: SAFETY_NODES } }));
</script>

<div
	class="{traced
		? ''
		: 'mt-1.5'} flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]"
	title="Declined by an open safety classifier before the model ran — the model did not generate this response.{label
		? ` Flagged label: ${label}.`
		: ''}"
>
	{#if !traced}
		<span class="size-[6px] shrink-0 rounded-full" style="background: var(--ap-gap)"></span>
	{/if}
	<span>Flagged by {source}</span>
	<button
		type="button"
		class="text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
		onclick={flashSafety}
	>
		show on map ↗
	</button>
</div>
