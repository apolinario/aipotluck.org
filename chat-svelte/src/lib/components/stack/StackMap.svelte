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
	import { resolveModelIdentity } from "$lib/identity";

	interface Props {
		// True while a turn is streaming/submitted — pulses the model node and,
		// on turn end, persists the answer's provenance highlight.
		active?: boolean;
		messages?: Message[];
	}
	let { active = false, messages = [] }: Props = $props();

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
		// Headline name, version brand + served size ("Apertus 70B"), derived from
		// the served checkpoint so the map title matches the provenance badge and both
		// update themselves if the served model flips. See identity.ts.
		const modelShort = resolveModelIdentity(sv.servedCheckpoint).short;
		for (const layer of d.layers) {
			for (const node of layer.nodes) {
				node.nm = node.nm.replaceAll("{modelShort}", modelShort);
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
	// Transient per-event "beat": flashing a node (web search resolved, or an agent step advanced) gives
	// it a brief .ap-pulse on top of the static trail, so repeated flashes (one per agent step) read as
	// the node actively working. Cleared after one breath; a fresh flash refreshes the timer.
	let beatIds = $state<Set<string>>(new Set());
	let beatTimer: ReturnType<typeof setTimeout> | undefined;
	// SUSTAINED per-stage pulse (distinct from the 700ms one-shot beat): the inline
	// provenance trace drives `ap:pulse-on`/`ap:pulse-off` as each pipeline stage goes
	// live and completes DURING streaming, so the map breathes the exact layer the
	// inline trace is drawing right now (CF: "inline trace segments activate parts of the
	// stack diagram"). A node stays pulsed until its stage emits pulse-off (or the turn
	// ends), unlike the beat which self-clears.
	let pulseIds = $state<Set<string>>(new Set());
	// Coalesce a pulse-off that's immediately followed by a pulse-on for the same node: chat
	// reconcile swaps the streaming message's trace component at stream start, so the old
	// instance's teardown fires pulse-off ~1ms before the replacement's pulse-on (a sub-frame
	// flicker). A short debounce on REMOVALS lets the re-on cancel the off, so the node pulses
	// smoothly. Additions stay immediate.
	const PULSE_OFF_DEBOUNCE_MS = 120;
	let pendingOff = new Set<string>();
	let offTimer: ReturnType<typeof setTimeout> | undefined;
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
			// transient beat on the just-flashed node(s) (so per-step agent flashes visibly pulse — an
			// agent step beats both the Apertus model node and the Hermes agent node together)
			beatIds = new Set(ids);
			clearTimeout(beatTimer);
			beatTimer = setTimeout(() => (beatIds = new Set()), 700);
			requestAnimationFrame(() => scrollNodeIntoView(ids.at(-1)));
		};
		window.addEventListener("ap:flash", onFlash);

		// Sustained per-stage pulse. pulse-on adds nodes (and trails them so the highlight
		// survives the eventual pulse-off); pulse-off removes them — an empty/absent id list
		// means "clear all", a turn-level reset.
		const onPulseOn = (e: Event) => {
			const ids = (e as CustomEvent<{ ids: string[] }>).detail?.ids ?? [];
			if (!ids.length) return;
			ids.forEach((id) => pendingOff.delete(id)); // a re-on cancels a queued removal
			const next = new Set(pulseIds);
			ids.forEach((id) => next.add(id));
			pulseIds = next;
		};
		const onPulseOff = (e: Event) => {
			const ids = (e as CustomEvent<{ ids: string[] }>).detail?.ids ?? [];
			if (!ids.length) {
				// empty list = turn-level reset: clear immediately, cancel any queued removals.
				pendingOff.clear();
				clearTimeout(offTimer);
				pulseIds = new Set();
				return;
			}
			// Debounce the removal so a near-immediate re-on (trace component swap) cancels it.
			ids.forEach((id) => pendingOff.add(id));
			clearTimeout(offTimer);
			offTimer = setTimeout(() => {
				if (!pendingOff.size) return;
				const next = new Set(pulseIds);
				pendingOff.forEach((id) => next.delete(id));
				pendingOff.clear();
				pulseIds = next;
			}, PULSE_OFF_DEBOUNCE_MS);
		};
		window.addEventListener("ap:pulse-on", onPulseOn);
		window.addEventListener("ap:pulse-off", onPulseOff);

		return () => {
			cancelled = true;
			clearReveal();
			clearTimeout(beatTimer);
			clearTimeout(offTimer);
			window.removeEventListener("ap:flash", onFlash);
			window.removeEventListener("ap:pulse-on", onPulseOn);
			window.removeEventListener("ap:pulse-off", onPulseOff);
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
			// Turn finished: drop any sustained pulse so the staged reveal/trail takes over as
			// the persistent highlight (guards against a missed pulse-off, e.g. a dropped turn).
			pendingOff.clear();
			clearTimeout(offTimer);
			if (pulseIds.size) pulseIds = new Set();
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

<!-- Fills 100% of whatever wraps it. The reveal chrome (position, size, slide, scrim,
     close) is owned by the overlay in ChatWindow — this component is just the map, so the
     same markup serves the desktop drawer and the mobile sheet with no platform fork. -->
<aside
	class="pointer-events-auto flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[radial-gradient(120%_90%_at_70%_0%,var(--ap-map-grad-1),var(--ap-map-grad-2))]"
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
							pulsed={(active && TURN_PULSE.includes(node.id)) ||
								beatIds.has(node.id) ||
								pulseIds.has(node.id)}
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
