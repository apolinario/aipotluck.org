<script lang="ts">
	import { untrack } from "svelte";
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";
	import type { SearchSource } from "$lib/types/Search";
	import { WEBSEARCH_NODE } from "../stack/reveal";

	// Provenance for a search-grounded answer: the numbered open sources the model
	// was told to cite. Collapsible to stay out of the way; every [n] in the answer
	// resolves to a row here. "show on map" flashes the Web-search node so the chat
	// event mirrors in the live stack. Wikipedia is labeled open-public-knowledge,
	// Marginalia broader-open-web (varies), OpenAlex open-scholarly-index — the honesty
	// the thesis needs (see ENGINE_META below; keep in sync with SEARCH_ENGINES).
	// Ported from the Next chat/ app (components/chat/source-strip.tsx).

	interface Props {
		sources: SearchSource[];
		asOf: string;
		query?: string;
		// Rendered inside ProvenanceTrace: the spine draws the node + owns the vertical rhythm, so
		// drop this cell's own card chrome (border/bg/top-margin) and the per-step "show on map" link
		// (the trace carries ONE consolidated "behind the scenes" link at its tail instead). Keeps
		// every step on one consistent inline cell system instead of a boxed card amid bare lines.
		traced?: boolean;
	}
	let { sources, asOf, query, traced = false }: Props = $props();

	const ENGINE_META: Record<SearchSource["engine"], { note: string; color: string }> = {
		Wikipedia: { note: "open public knowledge", color: "var(--ap-live)" },
		Marginalia: { note: "broader open web · varies", color: "var(--ap-building)" },
		OpenAlex: { note: "open scholarly index", color: "var(--ap-live)" },
	};

	const flashWebsearch = () =>
		window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: [WEBSEARCH_NODE] } }));

	let open = $state(false);

	// `asOf` is the search-time instant (ISO/UTC). Render the DATE in the viewer's local timezone so a
	// reader behind UTC never sees a "future" date — slicing the ISO string shows the UTC calendar day,
	// which is tomorrow for an evening-in-the-Americas reader. SSR uses the UTC slice as a
	// hydration-stable fallback; the $effect (client-only) upgrades it to the local date, so first paint
	// matches on both sides and the swap is benign.
	// untrack: the initial value is deliberately the UTC slice (a stable SSR/hydration fallback);
	// capturing only asOf's initial value here is intended, the $effect below owns later updates.
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
	<!-- Two skins from one markup: standalone = a self-contained rounded card; `traced` = chrome-free
	     so it sits as one cell on ProvenanceTrace's spine (the spine owns the dot + rhythm). The
	     expand/collapse + source list are identical either way — honesty copy lives in one place. -->
	<div
		in:fly={{ y: 6, duration: prefersReducedMotion.current ? 0 : 360 }}
		class={traced
			? "font-mono text-[10.5px]"
			: "mt-1.5 rounded-lg border border-[var(--ap-rule)] bg-[var(--ap-paper)]/40 font-mono text-[10.5px]"}
	>
		<div class="flex items-center gap-2 {traced ? '' : 'px-2.5 py-1.5'}">
			<!-- Standalone gets a ≥44px thumb target; traced does NOT — inside the spine the row must
			     stay its natural single-line height so its first line aligns with the spine dot (a tall
			     min-h would vertically-center the text and decouple it from the dot). The collapsed
			     header is the primary 44px target in the traced case. -->
			<button
				type="button"
				class="flex {traced
					? ''
					: 'min-h-[44px]'} flex-1 items-center gap-1.5 text-left text-[var(--ap-ink-2)] transition-colors hover:text-[var(--ap-ink)]"
				aria-expanded={open}
				onclick={() => (open = !open)}
			>
				{#if !traced}
					<!-- traced: the spine draws the node, so suppress this leading dot to avoid doubling -->
					<span class="size-[6px] shrink-0 rounded-full" style="background:var(--ap-live);"></span>
				{/if}
				<!-- Leading label mirrors SourceClass's "from training" so the two source-class
				     states read as a deliberate matched pair (deck p38). Web genuinely ran a lookup,
				     so "looked it up" is honest here. -->
				<span class="font-semibold tracking-[0.04em] text-[var(--ap-ink)]">looked it up</span>
				<span class="text-[var(--ap-ink-3)]" aria-hidden="true">·</span>
				<span>
					{sources.length} open source{sources.length === 1 ? "" : "s"}{date
						? ` · as of ${date}`
						: ""}
				</span>
				<span class="ml-0.5 text-[var(--ap-ink-3)]" aria-hidden="true">{open ? "▾" : "▸"}</span>
			</button>
			{#if !traced}
				<button
					type="button"
					class="ml-auto text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
					onclick={flashWebsearch}
				>
					show on map ↗
				</button>
			{/if}
		</div>

		{#if open}
			<!-- traced: indent the list under the spine instead of a card divider -->
			<div class={traced ? "" : "border-t border-[var(--ap-rule)]"}>
				{#if query}
					<div class="pt-1.5 text-[var(--ap-ink-3)] {traced ? '' : 'px-2.5'}">
						searched open sources for:
						<span class="text-[var(--ap-ink-2)]">“{query}”</span>
					</div>
				{/if}
				<ol class="flex flex-col gap-1.5 pt-1.5 pb-0.5 {traced ? '' : 'px-2.5 py-2'}">
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
