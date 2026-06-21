<script lang="ts">
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";
	import { blindSpotsOpen } from "$lib/stores/blindSpots";

	// The honest "what did this answer DRAW ON" line — the source-class of the content,
	// orthogonal to ProvenanceBadge (which names what MODEL ran). Every answer belongs to
	// exactly one source class; only one indicator shows per answer:
	//
	//   web   → grounded in open web search (Wikipedia/Marginalia/OpenAlex). Rendered RICHLY by
	//           SourceStrip (numbered, citable, "as of DATE"), so this component does NOT
	//           cover it — SourceStrip IS the web class's expression.
	//   model → no live lookup happened; the answer comes from the model's own parametric
	//           knowledge. This is the honest counterpart to "N open sources" — without it,
	//           an ungrounded answer silently reads as sourced as a grounded one. The blind
	//           spots most apply HERE (recency, can-be-wrong), so it links to that disclosure.
	//   docs  → (future) grounded in the user's UPLOADED documents (RAG). Wired now, inert
	//           until file-upload/RAG lands — adding it is then one META entry + one call site,
	//           not a rewrite. This is where the source-class distinction earns its keep.
	//
	// Deliberately NOT a claim of perfect attribution: it names the class of grounding the
	// answer was (or wasn't) given, which is exactly what an honest reader needs to calibrate.

	interface Props {
		kind: "model" | "docs";
		// When rendered inside ProvenanceTrace, the trace draws the spine node, so the
		// indicator suppresses its own leading dot to avoid a doubled marker.
		traced?: boolean;
	}
	let { kind, traced = false }: Props = $props();

	// Each class leads with a quiet sentence-case LABEL so the source-class indicators read as a
	// deliberate matched set with the web case (SourceStrip's "looked it up") — the deck's
	// two-state badge treatment (p38). The label is the class; the text is the honest detail.
	// (Sentence case, not all-caps: a per-answer label should not shout.)
	const META: Record<Props["kind"], { dot: string; label: string; text: string }> = {
		// Muted ink dot, not the live green — parametric knowledge is static, not a live feed.
		// Label is "from training" (the class); the detail stays "no live sources" — NOT the
		// deck's "no lookup". "no live sources" is true whether no search ran OR a search ran
		// and found nothing — in both, no sources grounded the answer (webSearch is only set when
		// sources.length > 0; see conversation/[id]/+server.ts). The honest invariant is "nothing
		// live grounded this", not a claim about whether a lookup was attempted.
		model: { dot: "var(--ap-ink-3)", label: "from training", text: "no live sources" },
		// Distinct from web (live) and model (static): user-supplied grounding.
		docs: {
			dot: "var(--ap-building)",
			label: "your docs",
			text: "grounded in your uploaded documents",
		},
	};
	let meta = $derived(META[kind]);
</script>

<div
	in:fly={{ y: 6, duration: prefersReducedMotion.current ? 0 : 360 }}
	class="{traced
		? ''
		: 'mt-1.5'} flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]"
	title={kind === "model"
		? "No live sources grounded this answer — it’s drawn from the model’s training, which it cannot reliably date and which can be wrong. See Blind spots."
		: "This answer was grounded in documents you uploaded."}
>
	{#if !traced}
		<span class="size-[6px] shrink-0 rounded-full" style="background: {meta.dot}"></span>
	{/if}
	<span class="font-semibold tracking-[0.04em] text-[var(--ap-ink-2)]">{meta.label}</span>
	<span class="text-[var(--ap-ink-3)]" aria-hidden="true">·</span>
	<span>{meta.text}</span>
	{#if kind === "model" && !traced}
		<!-- In the trace, the head "?" already opens Blind spots and the tail carries the single
		     "behind the scenes ↗"; a per-step link here would just duplicate those. Standalone keeps it. -->
		<button
			type="button"
			class="text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
			onclick={() => blindSpotsOpen.set(true)}
		>
			blind spots ↗
		</button>
	{/if}
</div>
