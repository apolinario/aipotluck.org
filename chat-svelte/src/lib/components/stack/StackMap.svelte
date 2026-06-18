<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import type { Message } from "$lib/types/Message";
	import MapNode from "./MapNode.svelte";
	import { type StackMapData, type StackStatus } from "./types";
	import { MODEL_NODES, computeRevealStages } from "./reveal";
	import { resolveServing, type ServingProvenance } from "$lib/servingProvenance";

	interface Props {
		// True while a turn is streaming/submitted — pulses the model node and,
		// on turn end, persists the answer's provenance highlight.
		active?: boolean;
		messages?: Message[];
		// Below md the map shares the viewport with the chat via the tab switcher
		// in ChatWindow; this says whether the map tab is the active one. From md
		// up the map is always visible and this is ignored.
		mobileActive?: boolean;
	}
	let { active = false, messages = [], mobileActive = false }: Props = $props();

	// Serving provenance (config-derived; see servingProvenance.ts) — drives both
	// the header copy AND whether the sovereign compute cell lights per answer.
	// Falls back to a generic resolve so node tokens never render literally.
	const serving: ServingProvenance = $derived(page.data.servingProvenance ?? resolveServing());

	// The node every answer genuinely runs through — the model — pulsed while a
	// turn streams and persisted after. The router stays a static `building` node
	// (nothing routes today). The CSCS compute cell lights per answer ONLY when we
	// serve directly on it (serving.isSovereign) — otherwise it stays a static
	// production-target, because this prototype isn't actually running there.
	const TURN_PULSE: string[] = [...MODEL_NODES];

	// Replace the serving-dependent tokens in the static map copy with the live,
	// config-derived facts — so the map states what's ACTUALLY serving (checkpoint,
	// routing provider, whether CSCS serves this prototype yet) and can't drift.
	function applyServingTokens(d: StackMapData, sv: ServingProvenance): StackMapData {
		for (const layer of d.layers) {
			for (const node of layer.nodes) {
				node.d = node.d
					.replaceAll("{servedCheckpoint}", sv.servedCheckpoint)
					.replaceAll("{cscsServingNote}", sv.cscsServingNote)
					.replaceAll("{routingProvider}", sv.routingProvider);
				if (node.id === "apertus") node.url = sv.checkpointUrl;
			}
		}
		return d;
	}

	// Legend uses the AA text variants (the coverage BAR above keeps the bright fills) so the
	// "5 live / 4 building / 1 gap" text clears WCAG AA on the map panel.
	const COVERAGE_LEGEND: { key: StackStatus; label: string; mark: string; color: string }[] = [
		{ key: "live", label: "live", mark: "●", color: "var(--ap-live-text)" },
		{ key: "building", label: "building", mark: "●", color: "var(--ap-building-text)" },
		{ key: "gap", label: "gap", mark: "●", color: "var(--ap-gap-text)" },
		{ key: "wanted", label: "open invitations", mark: "○", color: "var(--ap-ink-3)" },
	];

	const WANTED_FILL =
		"repeating-linear-gradient(45deg,#d6d0c6,#d6d0c6 4px,#e7e2da 4px,#e7e2da 8px)";

	let data = $state<StackMapData | null>(null);
	// Currently-highlighted ("show on map" / safety event / turn provenance) node
	// ids. State-driven so the highlight survives the re-render an incoming chat
	// message triggers.
	let trailIds = $state<string[]>([]);
	let container = $state<HTMLElement | undefined>();

	const scrollNodeIntoView = (id: string | undefined) => {
		if (!id || !container) return;
		const el = container.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
		if (!el) return;
		// Center the node WITHIN the map's own scroll container. scrollIntoView({block:"center"})
		// also pans the outer page and, in this nested scroll, tends to land the node above the
		// fold — so scroll the container directly by the measured delta instead (deterministic).
		const elRect = el.getBoundingClientRect();
		const cRect = container.getBoundingClientRect();
		const delta = elRect.top - cRect.top - (container.clientHeight - el.clientHeight) / 2;
		container.scrollBy({ top: delta, behavior: "smooth" });
	};

	// Staged reveal: light the answer's real provenance stages one at a time so the
	// stack "comes alive" after each query (Josh: "feel alive and active") instead of
	// snapping every highlight on at once. Cosmetic ORDERING only — every stage shown
	// genuinely ran (search grounds first, then the model answers); a stage never
	// appears unless it actually happened. Reduced-motion users get the instant set.
	let revealTimers: ReturnType<typeof setTimeout>[] = [];
	const clearReveal = () => {
		revealTimers.forEach(clearTimeout);
		revealTimers = [];
	};
	const stagedReveal = (stages: string[]) => {
		clearReveal();
		if (prefersReducedMotion.current) {
			trailIds = stages;
			scrollNodeIntoView(stages.at(-1));
			return;
		}
		trailIds = [];
		stages.forEach((id, i) => {
			revealTimers.push(
				setTimeout(() => {
					trailIds = stages.slice(0, i + 1);
					scrollNodeIntoView(id);
				}, i * 460)
			);
		});
	};

	onMount(() => {
		let cancelled = false;
		fetch(`${base}/data/stack-map.json`)
			.then((r) => r.json())
			.then((d: StackMapData) => {
				if (!cancelled) data = applyServingTokens(d, serving);
			})
			.catch(() => {
				/* map is non-critical chrome */
			});

		// "show on map" → flash the referenced nodes. Only the most recent
		// highlight stays, so the trail always points at the latest event.
		const onFlash = (e: Event) => {
			clearReveal(); // a manual "show on map" overrides any in-flight staged reveal
			const ids = (e as CustomEvent<{ ids: string[] }>).detail?.ids ?? [];
			trailIds = ids;
			requestAnimationFrame(() => scrollNodeIntoView(ids.at(-1)));
		};
		window.addEventListener("ap:flash", onFlash);

		return () => {
			cancelled = true;
			clearReveal();
			window.removeEventListener("ap:flash", onFlash);
		};
	});

	// Scroll the pulsed model node into view when a turn begins — but only if a
	// deliberate flash (search / "show on map") hasn't already positioned the map.
	// When a turn finishes, PERSIST the answer's real provenance as the highlight
	// so the green doesn't vanish. Keyed on `active`; messages/trailIds reads are
	// untracked so this only fires on the streaming transition, not every token.
	let wasActive = false;
	$effect(() => {
		const isActive = active;
		untrack(() => {
			if (isActive) {
				clearReveal(); // a fresh turn cancels any pending reveal from the last one
				wasActive = true;
				if (trailIds.length === 0) scrollNodeIntoView(TURN_PULSE[0]);
				return;
			}
			if (!wasActive) return;
			wasActive = false;
			const lastAnswer = [...messages].reverse().find((m) => m.from === "assistant");
			if (!lastAnswer) return;
			// Persist the answer's real provenance: the model node always, plus the
			// Web-search node when the turn was grounded on open sources.
			// A declined turn never reached the model: highlight ONLY the toxic-bert
			// node so the map honestly shows what actually ran (the safety pre-screen,
			// not Apertus). This is the moderation extension point referenced above.
			// Which nodes light, in real pipeline order — honest by construction
			// (declined → safety only; searched → search → model; else model).
			// The invariant lives in reveal.ts and is unit-tested there.
			stagedReveal(
				computeRevealStages(lastAnswer, { servedOnSovereignCompute: serving.isSovereign })
			);
		});
	});

	let counts = $derived(data?.coverage);
</script>

<aside
	class="pointer-events-auto min-w-0 flex-col overflow-hidden bg-[radial-gradient(120%_90%_at_70%_0%,var(--ap-map-grad-1),var(--ap-map-grad-2))] md:flex md:w-[44%] md:shrink-0 md:border-l md:border-[var(--ap-rule)] xl:w-[46%] {mobileActive
		? 'flex min-h-0 w-full flex-1'
		: 'hidden'}"
>
	<!-- header -->
	<div class="shrink-0 px-[22px] pt-[14px] pb-2">
		<div class="flex items-center gap-2">
			<span
				class="size-2 rounded-full"
				style="background:{active ? 'var(--ap-coral)' : 'var(--ap-ink-3)'};opacity:{active
					? 1
					: 0.5};"
			></span>
			<span class="font-mono text-[10px] tracking-[0.1em] text-[var(--ap-ink-3)] uppercase">
				Under the hood{active ? " · running" : ""}
			</span>
		</div>
		<h2 class="mt-0.5 font-serif text-[24px] text-[var(--ap-ink)]">What's behind every answer</h2>
		<!-- Honest serving disclosure, config-derived (servingProvenance.ts): states
		     the live serving host — HF prototype host vs CSCS sovereign compute. -->
		<p class="mt-1 text-[11px] leading-snug text-[var(--ap-ink-3)]">
			{serving.mapHeaderLine}
		</p>
	</div>

	<!-- coverage bar -->
	{#if counts}
		<div class="shrink-0 px-[22px] pb-1">
			<div class="flex h-[9px] overflow-hidden rounded-[5px] border border-[var(--ap-rule)]">
				<span style="flex:{counts.live};background:var(--ap-live);"></span>
				<span style="flex:{counts.building};background:var(--ap-building);"></span>
				<span style="flex:{counts.gap};background:var(--ap-gap);"></span>
				<span style="flex:{counts.wanted};background:{WANTED_FILL};"></span>
			</div>
			<div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px]">
				{#each COVERAGE_LEGEND as l}
					<span style="color:{l.color};">{l.mark} {counts[l.key]} {l.label}</span>
				{/each}
				<span class="text-[var(--ap-ink-3)] opacity-70">
					· click a component to inspect what's behind it
				</span>
			</div>
		</div>
	{/if}

	<!-- layers -->
	<div bind:this={container} class="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1.5 pb-[22px]">
		{#each data?.layers ?? [] as layer (layer.label)}
			<div
				class="flex items-center gap-[14px] border-b border-dashed border-[var(--ap-rule)] py-[9px] last:border-b-0"
			>
				<div class="flex flex-1 flex-wrap gap-[10px]">
					{#each layer.nodes as node (node.id)}
						<MapNode
							{node}
							pulsed={active && TURN_PULSE.includes(node.id)}
							trailed={trailIds.includes(node.id)}
						/>
					{/each}
				</div>
				<div
					class="w-[68px] shrink-0 text-right font-mono text-[10px] tracking-[0.1em] text-[var(--ap-ink-3)] uppercase"
				>
					{layer.label}
				</div>
			</div>
		{/each}
	</div>
</aside>
