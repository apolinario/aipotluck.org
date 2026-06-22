<script lang="ts">
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";
	import { VAULT_NODE } from "../stack/reveal";

	interface Props {
		synthesis: string;
	}
	let { synthesis }: Props = $props();

	const flashVault = () =>
		window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: [VAULT_NODE] } }));

	let open = $state(false);
</script>

{#if synthesis?.trim()}
	<div
		in:fly={{ y: 6, duration: prefersReducedMotion.current ? 0 : 360 }}
		class="mt-1.5 rounded-lg border border-[var(--ap-rule)] bg-[var(--ap-paper)]/40 font-mono text-[10.5px]"
	>
		<div class="flex items-center gap-2 px-2.5 py-1.5">
			<button
				type="button"
				class="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[var(--ap-ink-2)] transition-colors hover:text-[var(--ap-ink)]"
				onclick={() => (open = !open)}
			>
				<span class="size-[6px] shrink-0 rounded-full" style="background:var(--ap-building);"></span>
				<span class="font-semibold tracking-[0.08em] text-[var(--ap-ink)] uppercase"
					>federated local knowledge</span
				>
				<span class="text-[var(--ap-ink-3)]">{open ? "▾" : "▸"}</span>
			</button>
			<button
				type="button"
				class="ml-auto shrink-0 text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
				onclick={flashVault}
			>
				show on map ↗
			</button>
		</div>
		{#if open}
			<div class="border-t border-[var(--ap-rule)] px-2.5 py-2 leading-snug text-[var(--ap-ink-2)]">
				{synthesis.trim()}
			</div>
		{/if}
	</div>
{/if}
