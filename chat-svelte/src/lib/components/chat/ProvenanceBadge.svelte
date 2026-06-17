<script lang="ts">
	import { providerDisplay, resolveModelIdentity } from "$lib/identity";

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
	}
	let { modelId, provider }: Props = $props();

	// "show on map" flashes the MODEL node — the thing the badge names that the
	// answer genuinely ran on. The compute it used is the inference provider (named
	// in the badge text), which has no map node; the sovereign-compute nodes
	// (CSCS/LUMI) stay as the static production-target layer rather than flashing
	// per-answer (this alpha is HF-served, not run on them).
	const MODEL_NODES = ["apertus"];

	let identity = $derived(resolveModelIdentity(modelId));
	let providerName = $derived(providerDisplay(provider));

	const flashModel = () =>
		window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: MODEL_NODES } }));
</script>

<div
	class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]"
	title="{identity.short} · {identity.maker} · {identity.openness} · served via {providerName}; sovereign-compute target: CSCS (Switzerland) & LUMI (Finland)"
>
	<span class="size-[6px] shrink-0 rounded-full" style="background: var(--ap-live)"></span>
	<span>{identity.short} · {identity.makerShort} · {providerName}</span>
	<button
		type="button"
		class="text-[var(--ap-coral)] underline-offset-2 hover:underline"
		onclick={flashModel}
	>
		show on map ↗
	</button>
</div>
