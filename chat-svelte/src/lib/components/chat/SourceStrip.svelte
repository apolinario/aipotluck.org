<script lang="ts">
	import type { SearchSource } from "$lib/types/Search";

	// Provenance for a search-grounded answer: the numbered open sources the model
	// was told to cite. Collapsible to stay out of the way; every [n] in the answer
	// resolves to a row here. "show on map" flashes the Web-search node so the chat
	// event mirrors in the live stack. Wikipedia is labeled authoritative-current;
	// Marginalia is labeled broader-open-web (varies) — the honesty the thesis needs.
	// Ported from the Next chat/ app (components/chat/source-strip.tsx).

	interface Props {
		sources: SearchSource[];
		asOf: string;
		query?: string;
	}
	let { sources, asOf, query }: Props = $props();

	const ENGINE_META: Record<SearchSource["engine"], { note: string; color: string }> = {
		Wikipedia: { note: "open public knowledge", color: "var(--ap-live)" },
		Marginalia: { note: "broader open web · varies", color: "var(--ap-building)" },
	};

	const flashWebsearch = () =>
		window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: ["websearch"] } }));

	let open = $state(false);
	let date = $derived(asOf?.slice(0, 10));
</script>

{#if sources?.length}
	<div
		class="mt-1.5 rounded-lg border border-[var(--ap-rule)] bg-[var(--ap-paper)]/40 font-mono text-[10.5px]"
	>
		<div class="flex items-center gap-2 px-2.5 py-1.5">
			<button
				type="button"
				class="flex items-center gap-1.5 text-[var(--ap-ink-2)] transition-colors hover:text-[var(--ap-ink)]"
				onclick={() => (open = !open)}
			>
				<span class="size-[6px] shrink-0 rounded-full" style="background:var(--ap-live);"></span>
				<span>
					{sources.length} open source{sources.length === 1 ? "" : "s"}{date
						? ` · as of ${date}`
						: ""}
				</span>
				<span class="text-[var(--ap-ink-3)]">{open ? "▾" : "▸"}</span>
			</button>
			<button
				type="button"
				class="ml-auto text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
				onclick={flashWebsearch}
			>
				show on map ↗
			</button>
		</div>

		{#if open}
			<div class="border-t border-[var(--ap-rule)]">
				{#if query}
					<div class="px-2.5 pt-2 text-[var(--ap-ink-3)]">
						searched open sources for:
						<span class="text-[var(--ap-ink-2)]">“{query}”</span>
					</div>
				{/if}
				<ol class="flex flex-col gap-1.5 px-2.5 py-2">
					{#each sources as s (s.n)}
						{@const meta = ENGINE_META[s.engine]}
						<li class="flex gap-2 leading-snug">
							<span class="shrink-0 text-[var(--ap-ink-3)]">[{s.n}]</span>
							<span class="min-w-0">
								<a
									class="break-words text-[var(--ap-ink)] underline-offset-2 hover:underline"
									href={s.url}
									rel="noreferrer"
									target="_blank">{s.title}</a
								>
								<span class="ml-1.5 whitespace-nowrap">
									<span style="color:{meta.color};">● </span>
									<span class="text-[var(--ap-ink-3)]">{meta.note}</span>
								</span>
							</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}
	</div>
{/if}
