<script lang="ts">
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";
	import { blindSpotsOpen } from "$lib/stores/blindSpots";

	// The honest "what did this answer DRAW ON" line — the source-class of the content,
	// orthogonal to ProvenanceBadge (which names what MODEL ran). Every answer belongs to
	// exactly one source class; only one indicator shows per answer:
	//
	//   web   → grounded in open web search (Wikipedia/Marginalia). Rendered RICHLY by
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
	}
	let { kind }: Props = $props();

	const META: Record<Props["kind"], { dot: string; text: string }> = {
		// Muted ink dot, not the live green — parametric knowledge is static, not a live feed.
		// "no live sources" (not "no live lookup"): true whether no search ran OR a search ran
		// and found nothing — in both, no sources grounded the answer (webSearch is only set when
		// sources.length > 0; see conversation/[id]/+server.ts). The honest invariant is "nothing
		// live grounded this", not a claim about whether a lookup was attempted.
		model: { dot: "var(--ap-ink-3)", text: "from the model’s own knowledge · no live sources" },
		// Distinct from web (live) and model (static): user-supplied grounding.
		docs: { dot: "var(--ap-building)", text: "grounded in your uploaded documents" },
	};
	let meta = $derived(META[kind]);
</script>

<div
	in:fly={{ y: 6, duration: prefersReducedMotion.current ? 0 : 360 }}
	class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]"
	title={kind === "model"
		? "No live sources grounded this answer — it’s drawn from the model’s training, which it cannot reliably date and which can be wrong. See Blind spots."
		: "This answer was grounded in documents you uploaded."}
>
	<span class="size-[6px] shrink-0 rounded-full" style="background: {meta.dot}"></span>
	<span>{meta.text}</span>
	{#if kind === "model"}
		<button
			type="button"
			class="text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
			onclick={() => blindSpotsOpen.set(true)}
		>
			blind spots ↗
		</button>
	{/if}
</div>
