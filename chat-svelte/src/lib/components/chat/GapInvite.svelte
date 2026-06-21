<script lang="ts">
	import { contributeOpen } from "$lib/stores/contribute";
	import type { StarterGap } from "$lib/constants/starterGaps";

	// "This answer touches a gap in the open stack → get involved." Shown under an answer
	// whose originating prompt deliberately surfaces a known gap (see starterGaps). Two
	// honest actions, both reusing existing seams: pulse + deep-link the gap's node on the
	// live-stack map (the same `ap:flash` CustomEvent SafetyBadge/SourceStrip use), and open
	// the contribution form prefilled with the gap's ask (the contributeOpen { topic } seam
	// the live-stack map's own gap nodes already use). No new machinery.
	interface Props {
		gap: StarterGap;
	}
	let { gap }: Props = $props();

	const flash = () =>
		window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: [gap.node] } }));

	const getInvolved = () => {
		flash();
		contributeOpen.set({ topic: gap.ask });
	};
</script>

<div
	class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]"
	title="This answer runs up against a gap in the open-source stack — a place the public stack isn't built out yet. You can see it on the live-stack map and help close it."
>
	<span class="size-2 shrink-0 rounded-full" style="background: var(--ap-gap)"></span>
	<span>Touches an open gap: {gap.ask}</span>
	<!-- One CTA per line: "get involved →" already flashes the gap's node (via getInvolved → flash)
	     AND opens the prefilled contribution form, so it fully subsumes the old separate "see the
	     gap ↗" link — two links on one line read as redundant. -->
	<button
		type="button"
		class="whitespace-nowrap text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
		onclick={getInvolved}
	>
		get involved →
	</button>
</div>
