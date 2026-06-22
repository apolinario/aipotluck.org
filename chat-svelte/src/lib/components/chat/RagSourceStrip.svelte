<script lang="ts">
	import { untrack } from "svelte";
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";
	import type { RagSource } from "$lib/types/Rag";
	import { ragRetrievalNodes } from "../stack/reveal";

	interface Props {
		sources: RagSource[];
		asOf: string;
		query?: string;
	}
	let { sources, asOf, query }: Props = $props();

	const ENGINE_META: Record<
		Exclude<RagSource["engine"], "SyftHub:Vault">,
		{ label: string; note: string; color: string }
	> = {
		Potluck: { label: "from catalog", note: "AI Potluck gap-map", color: "var(--ap-live)" },
		"SyftHub:EPFL": { label: "from federated news", note: "EPFL News · SyftHub", color: "var(--ap-building)" },
	};

	const flashRagNodes = () => {
		const ids = ragRetrievalNodes({ sources });
		if (ids.length) {
			window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids } }));
		}
	};

	let open = $state(false);

	let date = $state(untrack(() => asOf?.slice(0, 10) ?? ""));
	$effect(() => {
		if (!asOf) return;
		const d = new Date(asOf);
		if (!Number.isNaN(d.getTime())) {
			date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		}
	});
</script>

{#if sources?.length}
	<div
		in:fly={{ y: 6, duration: prefersReducedMotion.current ? 0 : 360 }}
		class="mt-1.5 rounded-lg border border-[var(--ap-rule)] bg-[var(--ap-paper)]/40 font-mono text-[10.5px]"
	>
		<div class="flex items-center gap-2 px-2.5 py-1.5">
			<button
				type="button"
				class="flex items-center gap-1.5 text-[var(--ap-ink-2)] transition-colors hover:text-[var(--ap-ink)]"
				onclick={() => (open = !open)}
			>
				<span class="size-[6px] shrink-0 rounded-full" style="background:var(--ap-live);"></span>
				<span class="font-semibold tracking-[0.08em] text-[var(--ap-ink)] uppercase"
					>retrieved context</span
				>
				<span class="text-[var(--ap-ink-3)]" aria-hidden="true">·</span>
				<span>
					{sources.length} source{sources.length === 1 ? "" : "s"}{date ? ` · as of ${date}` : ""}
				</span>
				<span class="text-[var(--ap-ink-3)]">{open ? "▾" : "▸"}</span>
			</button>
			<button
				type="button"
				class="ml-auto text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
				onclick={flashRagNodes}
			>
				show on map ↗
			</button>
		</div>

		{#if open}
			<div class="border-t border-[var(--ap-rule)]">
				{#if query}
					<div class="px-2.5 pt-2 text-[var(--ap-ink-3)]">
						retrieved for:
						<span class="text-[var(--ap-ink-2)]">"{query}"</span>
					</div>
				{/if}
				<ol class="flex flex-col gap-1.5 px-2.5 py-2">
					{#each sources as s (s.n)}
						{@const meta = ENGINE_META[s.engine as keyof typeof ENGINE_META]}
						<li class="flex gap-2 leading-snug">
							<span class="shrink-0 text-[var(--ap-ink-3)]">[{s.n}]</span>
							<span class="min-w-0">
								{#if s.url}
									<a
										class="break-words text-[var(--ap-ink)] underline-offset-2 hover:underline"
										href={s.url}
										rel="noreferrer"
										target="_blank">{s.title}</a
									>
								{:else}
									<span class="break-words text-[var(--ap-ink)]">{s.title}</span>
								{/if}
								{#if meta}
									<span class="ml-1.5 whitespace-nowrap">
										<span style="color:{meta.color};">● </span>
										<span class="text-[var(--ap-ink-3)]">{meta.note}</span>
									</span>
								{/if}
							</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}
	</div>
{/if}
