<script lang="ts">
	import type { Model } from "$lib/types/Model";
	import { resolveModelIdentity } from "$lib/identity";
	import { suggestions } from "$lib/constants/suggestions";

	interface Props {
		currentModel: Model;
		onmessage?: (content: string) => void;
	}

	let { currentModel, onmessage }: Props = $props();

	// The model name is DERIVED from the actually-served model (never hardcoded) so
	// this line and the per-answer provenance badge can never disagree.
	const short = $derived(resolveModelIdentity(currentModel.id).short);

	// The six commitments (Ayah's value framework + the "collaboration" 6th, per
	// Julie's Web UX spec). Titles only — the values, not the partly-stale
	// supporting copy from the spec.
	const COMMITMENTS = [
		"Safe",
		"Ethical",
		"Human-flourishing",
		"Multilingual",
		"A public utility",
		"A collaboration",
	];
</script>

<div class="my-auto flex w-full flex-col items-center gap-6 px-4">
	<div class="flex flex-col items-center">
		<!-- Sans-bold like prod: prod reserves the serif for display headings (welcome,
		     map); the empty-state greeting is the functional sans-bold tier. -->
		<div
			class="text-center text-xl font-semibold tracking-tight text-balance text-[var(--ap-ink)] md:text-2xl"
		>
			Open-source, sovereign, community-configured.
		</div>
		<div class="mt-2 max-w-prose text-center text-[13px] text-balance text-[var(--ap-ink-3)]">
			Running on {short} by the Swiss National AI Initiative. This prototype is served via HuggingFace;
			the production stack runs on sovereign public compute. Not a company.
		</div>

		<div class="mt-3 flex max-w-md flex-col items-center gap-1 text-center">
			<div
				class="font-mono text-[10px] tracking-[0.16em] text-[var(--ap-ink-3)] uppercase opacity-70"
			>
				We are
			</div>
			<div
				class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 font-mono text-[11px] text-[var(--ap-ink-2)]"
			>
				{#each COMMITMENTS as c, i (c)}
					<span class="flex items-center gap-x-1.5">
						<span>{c}</span>
						{#if i < COMMITMENTS.length - 1}
							<span class="text-[var(--ap-ink-3)] opacity-50">·</span>
						{/if}
					</span>
				{/each}
			</div>
		</div>
	</div>

	<div
		class="no-scrollbar flex w-full gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible"
	>
		{#each suggestions as suggestion (suggestion)}
			<button
				type="button"
				class="h-auto w-full min-w-[200px] shrink-0 rounded-xl border border-[var(--ap-rule)]/50 bg-[var(--ap-paper-2)]/40 px-4 py-3 text-left text-[12px] leading-relaxed whitespace-nowrap text-[var(--ap-ink-3)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--ap-paper-2)]/70 hover:text-[var(--ap-ink)] hover:shadow-[var(--shadow-card)] sm:min-w-0 sm:shrink sm:p-4 sm:text-[13px] sm:whitespace-normal"
				onclick={() => onmessage?.(suggestion)}
			>
				{suggestion}
			</button>
		{/each}
	</div>
</div>
