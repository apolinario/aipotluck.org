<script lang="ts">
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";
	import { page } from "$app/state";
	import type { Message } from "$lib/types/Message";
	import SourceStrip from "./SourceStrip.svelte";
	import SourceClass from "./SourceClass.svelte";
	import ProvenanceBadge from "./ProvenanceBadge.svelte";
	import SafetyBadge from "./SafetyBadge.svelte";
	import SecondOpinion from "./SecondOpinion.svelte";
	import { blindSpotsOpen } from "$lib/stores/blindSpots";
	import { stackOpen } from "$lib/stores/stack";
	import {
		computePulseNodes,
		MODEL_NODES,
		COMPUTE_NODE,
		WEBSEARCH_NODE,
		SAFETY_NODES,
		ROUTER_NODE,
	} from "../stack/reveal";
	import { resolveServing } from "$lib/servingProvenance";
	import { resolveModelIdentity } from "$lib/identity";

	// The inline provenance TRACE — the stack diagram, inlined into the conversation.
	//
	// Why a trace and not a right-hand map flash: a quick pulse on a separate panel is
	// easy to miss (and on mobile the panel is a tab away), and the subtle "live" tint
	// barely reads. A trace solves both: it draws itself, segment by segment, AS each
	// stack layer activates (retrieve → ground → generate → verify), then STAYS DRAWN.
	// The receipt persists in scrollback. The spine carries the structure (Tufte: the
	// line is the data, not decoration); each layer's existing honest badge is the
	// segment body, so the honesty copy lives in ONE place (no duplication/drift). On
	// mobile this is a single narrow column — no split pane required.
	//
	// Reversible by construction: this wraps the same badges ChatMessage rendered flat;
	// pulling it out is reverting one block + the `traced` props.

	interface Props {
		message: Message;
		// Conversation's served model id, used when routerMetadata is absent.
		modelId?: string;
		loading?: boolean;
		// The user prompt this answer responded to — enables the second-opinion step.
		question?: string;
	}
	let { message, modelId, loading = false, question }: Props = $props();

	const reduce = $derived(prefersReducedMotion.current);

	// A stack layer is shown only when it actually happened. Order = the real pipeline.
	type StepKind = "retrieve" | "recall" | "generate" | "declined" | "verify";
	let declined = $derived(Boolean(message.moderation?.flagged));
	let answered = $derived(Boolean(!loading && message.content));
	let grounded = $derived(Boolean(message.webSearch?.sources?.length));
	// A second opinion is OPT-IN — it only counts as a pipeline step once one was actually obtained.
	// Listing "second opinion" before the user asks for one would imply a check happened that didn't.
	let verified = $derived(Boolean(message.verdict || message.opinions?.length));

	// Dot color per layer — solid markers on the spine, NOT a wash. Live = a real live
	// feed (web retrieval, the served model); muted ink = static parametric recall (not a
	// citation); gap-red = a safety decline; coral = the non-sovereign verification hop.
	// Dot legend, intentional: teal = a LIVE pipeline stage (web retrieval, the model running);
	// muted ink = a passive/optional stage (parametric recall, the optional cross-check) — calm, never
	// an alarm; gap-red is reserved for the ONE real stop (a safety decline). Verify is muted, NOT
	// coral: a red dot beside "second opinion unavailable" reads as an error when it's just optional.
	const DOT: Record<StepKind, string> = {
		retrieve: "var(--ap-live)",
		recall: "var(--ap-ink-3)",
		generate: "var(--ap-live)",
		declined: "var(--ap-gap)",
		verify: "var(--ap-ink-3)",
	};

	let steps = $derived(
		(
			[
				grounded ? "retrieve" : answered && !declined ? "recall" : null,
				answered ? (declined ? "declined" : "generate") : null,
				answered && !declined && verified ? "verify" : null,
			] as (StepKind | null)[]
		).filter((s): s is StepKind => s !== null)
	);

	// The answer is primary: the trace defaults to ONE compact summary line so it never pushes the
	// answer off-screen (user constraint). It auto-expands WHILE streaming — users wait longer when
	// they watch the pipeline draw (Perplexity finding) — then tucks back to the summary on
	// completion; tapping the head re-expands the full spine. One responsive form, no platform fork.
	let userExpanded = $state(false);
	let expanded = $derived(loading || userExpanded);

	let modelShort = $derived(resolveModelIdentity(message.routerMetadata?.model || modelId).short);
	// Terse receipt chips for the collapsed line — a glanceable summary, not the full cells.
	let summaryParts = $derived(
		steps
			.map((s) => {
				if (s === "retrieve") {
					const n = message.webSearch?.sources?.length ?? 0;
					return `${n} source${n === 1 ? "" : "s"}`;
				}
				if (s === "recall") return "from training";
				if (s === "generate") return modelShort;
				if (s === "declined") return "declined";
				if (s === "verify") return "second opinion";
				return "";
			})
			.filter(Boolean)
	);

	// Mirror the live trace onto the right-hand stack map: while THIS turn streams, emit a
	// SUSTAINED pulse on the map nodes whose layer is genuinely running, and clear it when
	// the turn ends. Node set comes from the ONE authority (computePulseNodes in reveal.ts),
	// which applies the same honesty gates as the turn-end reveal: model always, web-search
	// only when grounded, and sovereign compute (cscs) ONLY when the answer truly runs on it
	// — never flash CSCS while HF-served. We deliberately don't fake a precise
	// retrieve→generate boundary from the client; we pulse the layers that ran.
	const serving = $derived(page.data.servingProvenance ?? resolveServing());
	let pulsedNodes: string[] = [];
	const emitPulse = (ids: string[], on: boolean) => {
		if (!ids.length || typeof window === "undefined") return;
		window.dispatchEvent(new CustomEvent(on ? "ap:pulse-on" : "ap:pulse-off", { detail: { ids } }));
	};
	$effect(() => {
		const next = loading
			? computePulseNodes({ grounded, servedOnSovereignCompute: serving.isSovereign })
			: [];
		const off = pulsedNodes.filter((n) => !next.includes(n));
		const on = next.filter((n) => !pulsedNodes.includes(n));
		emitPulse(off, false);
		emitPulse(on, true);
		pulsedNodes = next;
	});
	// Belt-and-suspenders: if this trace unmounts mid-stream (turn reconcile / nav), drop its pulse.
	$effect(() => () => emitPulse(pulsedNodes, false));

	// "Behind the scenes ↗" — the ONE tail link that opens the full live-stack map (hidden by
	// default). It replaces every per-step "show on map ↗" so the trace carries a single, honest
	// path into the deeper view. The nodes it lights are exactly the layers THIS answer used
	// (same honesty gates as the pulse: model always; web-search only when grounded; safety only
	// on a decline; sovereign compute only when truly served on it; router only once a second
	// opinion ran) — so revealing the map foregrounds what actually happened, nothing fabricated.
	let revealNodes = $derived([
		...MODEL_NODES,
		...(grounded ? [WEBSEARCH_NODE] : []),
		...(declined ? SAFETY_NODES : []),
		...(serving.isSovereign ? [COMPUTE_NODE] : []),
		...(verified ? [ROUTER_NODE] : []),
	]);
	function openBehindScenes() {
		// Open first, then flash on the next tick so the highlight lands after the panel has begun
		// sliding in (the map stays mounted while closed, so the listener is always live).
		stackOpen.set(true);
		if (typeof window !== "undefined") {
			setTimeout(
				() => window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: revealNodes } })),
				0
			);
		}
	}
</script>

{#if steps.length || loading}
	<div class="mt-2 flex flex-col gap-1">
		<!-- Trace head: names the surface (echoes the map's "UNDER THE HOOD") and carries the
		     one teaching entry every answer needs. The per-step "blind spots ↗" only appears on
		     the recall step; a grounded answer has no recall step, so without this a grounded
		     answer would have no path to the teaching layer. The "?" opens the existing Blind
		     Spots disclosure (the slide-39 "why provenance matters" content already lives there —
		     recency, lookup-isn't-recall, language coverage, one-perspective), so we don't fork
		     a second copy of that honest copy. -->
		<div
			class="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] text-[var(--ap-ink-3)]/80 uppercase"
		>
			<!-- The head IS the collapse/expand control AND, when collapsed, the one-line receipt.
			     ≥44px hit area = thumb-comfortable on mobile (2026 SOTA); whole row tappable. The "?"
			     stays a SEPARATE button (no nested buttons) so it opens Blind Spots, not the toggle. -->
			<!-- The summary chips ARE the header — "how this answer was made" is implied by them, so we
			     drop the sentence. The chips persist in both states (collapsed receipt / expanded
			     accordion title); the spine adds the detail below. aria-label keeps it legible to SR. -->
			<button
				type="button"
				class="flex min-h-[44px] flex-1 items-center gap-1.5 text-left tracking-normal normal-case transition-colors hover:text-[var(--ap-ink-2)]"
				aria-expanded={expanded}
				aria-label="How this answer was made — {expanded ? 'collapse' : 'expand'} the trace"
				onclick={() => (userExpanded = !userExpanded)}
			>
				{#if summaryParts.length}
					<span class="font-mono text-[10px] text-[var(--ap-ink-3)]/90">
						{summaryParts.join(" · ")}
					</span>
				{:else}
					<span class="font-mono text-[10px] tracking-[0.08em] text-[var(--ap-ink-3)]/80 uppercase"
						>trace</span
					>
				{/if}
				<span class="text-[11px] text-[var(--ap-ink-3)]" aria-hidden="true"
					>{expanded ? "▾" : "▸"}</span
				>
			</button>
			<button
				type="button"
				class="flex size-[14px] shrink-0 items-center justify-center rounded-full border border-[var(--ap-ink-3)]/40 text-[9px] leading-none text-[var(--ap-ink-3)] transition-colors hover:border-[var(--ap-coral-text)] hover:text-[var(--ap-coral-text)]"
				title="Why provenance matters — and where this system is systematically weak."
				aria-label="Why this matters"
				onclick={() => blindSpotsOpen.set(true)}
			>
				?
			</button>
		</div>

		{#if expanded}
			<!-- Spine: each step is a flex row [dot · cell]. The dot is a REAL flex item, mt-aligned to the
			     cell's first text line so it can never decouple from its label, and every dot is one size.
			     A single hairline sits behind the dot column. -->
			<div
				class="ap-trace relative flex flex-col gap-2"
				transition:fly={{ y: -4, duration: reduce ? 0 : 220 }}
			>
				<div
					class="pointer-events-none absolute top-[7px] bottom-[7px] left-[3.5px] w-px"
					style="background: color-mix(in oklab, var(--ap-ink-3) 35%, transparent)"
					aria-hidden="true"
				></div>

				{#each steps as step (step)}
					<div class="flex gap-2" in:fly={{ y: 6, duration: reduce ? 0 : 320 }}>
						<span
							class="mt-[3.5px] size-2 shrink-0 rounded-full ring-2 ring-[var(--ap-paper)]"
							style="background: {DOT[step]}"
							aria-hidden="true"
						></span>
						<div class="min-w-0 flex-1">
							{#if step === "retrieve" && message.webSearch}
								<SourceStrip
									sources={message.webSearch.sources}
									asOf={message.webSearch.asOf}
									query={message.webSearch.query}
									traced
								/>
							{:else if step === "recall"}
								<SourceClass kind="model" traced />
							{:else if step === "declined" && message.moderation}
								<SafetyBadge
									kind={message.moderation.kind}
									label={message.moderation.label}
									traced
								/>
							{:else if step === "generate"}
								<ProvenanceBadge
									modelId={message.routerMetadata?.model || modelId}
									provider={message.routerMetadata?.provider}
									traced
								/>
							{:else if step === "verify" && question}
								<SecondOpinion
									{question}
									messageId={message.id}
									opinions={message.opinions}
									verdict={message.verdict}
								/>
							{/if}
						</div>
					</div>
				{/each}

				{#if loading}
					<div class="flex gap-2" in:fly={{ y: 6, duration: reduce ? 0 : 320 }}>
						<span
							class="mt-[3.5px] size-2 shrink-0 rounded-full ring-2 ring-[var(--ap-paper)]"
							style="background: var(--ap-live)"
							class:animate-pulse={!reduce}
							aria-hidden="true"
						></span>
						<span class="font-mono text-[10px] text-[var(--ap-ink-3)]">
							{grounded ? "Grounding · writing…" : "Writing…"}
						</span>
					</div>
				{/if}
			</div>

			{#if !loading && answered && !declined && question && !verified}
				<!-- Second opinion is opt-in: the OFFER is a tail action (dot-less, not a spine step, not in
				     the summary) so it never reads as a check that already happened. The spacer matches the
				     dot column so it left-aligns with the steps above. -->
				<div class="mt-2 flex gap-2">
					<span class="size-2 shrink-0" aria-hidden="true"></span>
					<div class="min-w-0 flex-1">
						<SecondOpinion
							{question}
							messageId={message.id}
							opinions={message.opinions}
							verdict={message.verdict}
						/>
					</div>
				</div>
			{/if}
			{#if !loading && steps.length}
				<!-- The ONE path into the deeper view: opens the full live-stack map (hidden by default)
				     and lights exactly the layers this answer used. Dot-less tail row — it's a way OUT of
				     the trace, not a step within it. Replaces every per-step "show on map ↗". -->
				<div class="mt-2 flex gap-2">
					<span class="size-2 shrink-0" aria-hidden="true"></span>
					<button
						type="button"
						class="min-w-0 flex-1 text-left font-mono text-[10.5px] text-[var(--ap-ink-3)] underline-offset-2 transition-colors hover:text-[var(--ap-coral-text)] hover:underline"
						onclick={openBehindScenes}
						title="See this answer on the live open-source stack map — the model, the open sources, the safety check, and where the public stack is still being built."
					>
						behind the scenes ↗
					</button>
				</div>
			{/if}
		{/if}
	</div>
{/if}
