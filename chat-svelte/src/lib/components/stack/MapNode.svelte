<script lang="ts">
	import ChevronDown from "~icons/lucide/chevron-down";
	import Sparkline from "./Sparkline.svelte";
	import { STATUS_LABEL, STATUS_VAR, STATUS_TEXT_VAR, type StackNode } from "./types";

	interface Props {
		node: StackNode;
		// Pulsed while this node's turn streams (animated breathing glow, .ap-pulse);
		// trailed = a persisted "show on map" / safety highlight (static wash, .ap-trail).
		pulsed?: boolean;
		trailed?: boolean;
	}
	let { node, pulsed = false, trailed = false }: Props = $props();

	const compact = new Intl.NumberFormat("en", { notation: "compact" });
	const fmt = (n: number | null | undefined) => (n != null ? compact.format(n) : "—");

	let open = $state(false);

	let isWanted = $derived(node.st === "wanted");
	let color = $derived(STATUS_VAR[node.st]);
	// AA-compliant text colour for the status LABEL (the bright `color` stays on the border).
	let textColor = $derived(STATUS_TEXT_VAR[node.st]);
	let atlas = $derived(node.atlas);

	let buttonClass = $derived(
		[
			"group relative flex flex-1 basis-[200px] flex-col select-text rounded-[10px] border-[1.5px] px-[15px] py-[10px] text-left transition-[border-color,box-shadow] duration-150",
			isWanted ? "border-dashed bg-transparent" : "border-[var(--ap-rule)] bg-[var(--ap-paper)]",
			pulsed ? "ap-pulse" : trailed ? "ap-trail" : "",
		].join(" ")
	);

	// Left accent border carries the status colour; wanted nodes get a dashed
	// outline with the status colour only on the left edge.
	let buttonStyle = $derived(
		`min-width:185px;border-left:4px ${isWanted ? "dashed" : "solid"} ${color};` +
			(isWanted ? `border-color:var(--ap-ink-3);border-left-color:${color};` : "")
	);
</script>

<button
	type="button"
	class={buttonClass}
	style={buttonStyle}
	data-node-id={node.id}
	aria-expanded={open}
	aria-label="{node.nm} — {node.st}. Tap to {open ? 'collapse' : 'expand'} details"
	onclick={() => (open = !open)}
>
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<div class="flex items-center gap-2 text-[14px] font-medium text-[var(--ap-ink)]">
				<span
					class="size-[9px] shrink-0 rounded-full"
					style={isWanted
						? "background:transparent;border:1.5px solid var(--ap-ink-3);"
						: `background:${color};`}
				></span>
				<span class="truncate">{node.nm}</span>
			</div>
			<div class="mt-0.5 truncate text-[12px] text-[var(--ap-ink-3)]">{node.org}</div>
		</div>
		<span
			class="shrink-0 font-mono text-[10px] tracking-[0.14em] uppercase"
			style="color:{isWanted ? 'var(--ap-coral-text)' : textColor};"
		>
			{STATUS_LABEL[node.st]}
		</span>
	</div>

	<div class="mt-1.5 text-[11.5px] leading-snug text-[var(--ap-ink-2)]">{node.d}</div>

	<!-- Subtle "expandable" affordance — strengthens on hover, flips when open. -->
	<ChevronDown
		aria-hidden="true"
		class="pointer-events-none absolute right-2 bottom-2 size-3 text-[var(--ap-ink-3)] opacity-25 transition-[transform,opacity] duration-200 group-hover:opacity-70 {open
			? 'rotate-180 opacity-50'
			: ''}"
	/>

	{#if open}
		<div class="mt-2 border-t border-dashed border-[var(--ap-rule)] pt-2">
			{#if atlas}
				<div class="space-y-1">
					<div class="flex items-center gap-2 font-mono text-[10px] text-[var(--ap-ink-3)]">
						<span>
							★ {fmt(atlas.stars)}{atlas.stars7d ? ` (+${compact.format(atlas.stars7d)}/wk)` : ""}
						</span>
						{#if atlas.sparkline}
							<Sparkline values={atlas.sparkline} />
						{/if}
					</div>
					<div class="font-mono text-[10px] leading-[1.7] text-[var(--ap-ink-3)]">
						{#if atlas.contributors != null}<span
								>{compact.format(atlas.contributors)} contributors ·
							</span>{/if}
						{#if atlas.language}<span>{atlas.language} · </span>{/if}
						{#if atlas.commits90d != null}<span
								>{compact.format(atlas.commits90d)} commits/90d ·
							</span>{/if}
						<span>{atlas.openness}</span>
						{#if atlas.license}<span> · {atlas.license}</span>{/if}
					</div>
					<div class="font-mono text-[10px] text-[var(--ap-ink-3)]">via OSO product-view</div>
				</div>
			{:else}
				<div class="font-mono text-[10px] leading-[1.7] text-[var(--ap-ink-3)]">
					{isWanted
						? "open projects exist for this"
						: (node.prov ?? "provenance on the live stack")}
				</div>
			{/if}

			{#if node.lineage}
				<div class="mt-2 space-y-1 border-t border-dashed border-[var(--ap-rule)] pt-2">
					<div class="font-mono text-[10px] text-[var(--ap-ink-2)]">
						training data — {node.lineage.summary}
					</div>
					{#if node.lineage.facts?.length}
						<ul class="font-mono text-[10px] leading-[1.7] text-[var(--ap-ink-3)]">
							{#each node.lineage.facts as f}
								<li>· {f}</li>
							{/each}
						</ul>
					{/if}
					{#if node.lineage.links?.length}
						<div class="flex flex-wrap gap-3 font-mono text-[10px]">
							{#each node.lineage.links as l}
								<a
									class="text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
									href={l.url}
									onclick={(e) => e.stopPropagation()}
									rel="noreferrer"
									target="_blank">{l.label}</a
								>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<div class="mt-2 flex gap-3 font-mono text-[10px]">
				{#if atlas?.url ?? node.url}
					<a
						class="text-[var(--ap-ink-2)] underline-offset-2 hover:underline"
						href={atlas?.url ?? node.url}
						onclick={(e) => e.stopPropagation()}
						rel="noreferrer"
						target="_blank">{node.url && !atlas ? "Open weights ↗" : "GitHub ↗"}</a
					>
				{/if}
				{#if isWanted || node.st === "gap"}
					<a
						class="font-semibold text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
						href="mailto:contact@aipotluck.org?subject={encodeURIComponent(
							`Get involved: ${node.nm}`
						)}"
						onclick={(e) => e.stopPropagation()}>Get involved →</a
					>
				{/if}
			</div>
		</div>
	{/if}
</button>
