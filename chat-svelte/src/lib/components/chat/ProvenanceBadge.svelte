<script lang="ts">
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";
	import { providerDisplay, resolveModelIdentity } from "$lib/identity";
	import { MODEL_NODES } from "../stack/reveal";

	// The honest provenance line for an assistant answer: what model ran, who made
	// it, and which inference provider actually served THIS request. The whole
	// product rests on honest provenance, so identity is resolved from the served
	// model id (message.routerMetadata.model) — never hardcoded — and the provider
	// is the per-request x-inference-provider the router reported, not a datacenter
	// we can't verify served the request. "show on map ↗" flashes the model node so
	// the chat event mirrors in the live stack ("Under the hood").
	// Ported from the Next chat/ app (components/stack/provenance.tsx).

	interface Props {
		// The served model id, e.g. "swiss-ai/Apertus-70B-Instruct-2509".
		modelId?: string;
		// The inference-provider slug from the router header, e.g. "publicai".
		provider?: string;
		// When rendered inside ProvenanceTrace, the trace draws the spine node, so the
		// badge suppresses its own leading dot to avoid a doubled marker.
		traced?: boolean;
	}
	let { modelId, provider, traced = false }: Props = $props();

	// "show on map" flashes the MODEL node — the thing the badge names that the
	// answer genuinely ran on. The compute it used is the inference provider (named
	// in the badge text), which has no map node; the sovereign-compute nodes
	// (CSCS/LUMI) stay as the static production-target layer rather than flashing
	// per-answer (this alpha is HF-served, not run on them). MODEL_NODES is the shared
	// authority (reveal.ts), not a local literal.

	let identity = $derived(resolveModelIdentity(modelId));
	let providerName = $derived(providerDisplay(provider));

	const flashModel = () =>
		window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: MODEL_NODES } }));
</script>

<!-- Provenance streams in on completion (Josh: "feel alive and active") rather than
     popping static. Mount-only fade/slide — cosmetic; the content is unchanged. -->
<div
	in:fly={{ y: 6, duration: prefersReducedMotion.current ? 0 : 360 }}
	class="{traced
		? ''
		: 'mt-1.5'} flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]"
	title="{identity.short} · {identity.maker} · {identity.openness}{identity.served
		? ` · served model: ${identity.served}`
		: ''} · served via {providerName}; sovereign-compute target: CSCS (Switzerland) & LUMI (Finland)"
>
	{#if !traced}
		<span class="size-[6px] shrink-0 rounded-full" style="background: var(--ap-live)"></span>
	{/if}
	<span>{identity.short} · {identity.makerShort} · {providerName}</span>
	{#if !traced}
		<!-- In the trace, the single "behind the scenes ↗" tail link reveals the map and lights this
		     node; a per-step "show on map" would be one of several redundant links. Standalone keeps it. -->
		<button
			type="button"
			class="text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
			onclick={flashModel}
		>
			show on map ↗
		</button>
	{/if}
</div>
