<script lang="ts">
	import { page } from "$app/stores";
	import { base } from "$app/paths";
	import CarbonRenew from "~icons/carbon/renew";
	import CarbonGroup from "~icons/carbon/group";
	import MarkdownRenderer from "./MarkdownRenderer.svelte";
	import type { Message } from "$lib/types/Message";
	import { ROUTER_NODE } from "../stack/reveal";

	// Collective second opinion, honest by construction. The Apertus answer is shown
	// above; one click fans the question out to a panel of independent open models in
	// parallel, then surfaces a VERDICT ON that answer — an agreement headline + where the
	// panel confirms it, challenges it, and what they all miss — plus the raw takes. It
	// never merges them into a new answer: the answer already exists; the panel verifies
	// it. Convergence is "more trustworthy", divergence is "scrutinise" — never an oracle.
	// The agreement summary is an automated read OVER the visible takes, not a verdict on
	// truth, and the panel isn't fully independent (some share lineage) — both said plainly.
	type Opinion = NonNullable<Message["opinions"]>[number];
	type Verdict = NonNullable<Message["verdict"]>;

	interface Props {
		question?: string;
		// Target assistant message id — the verdict + takes persist onto it.
		messageId?: string;
		// Persisted panel + verdict (rendered straight away on reload).
		opinions?: Message["opinions"];
		verdict?: Message["verdict"];
	}
	let { question, messageId, opinions, verdict }: Props = $props();

	// svelte-ignore state_referenced_locally
	let takes = $state<Opinion[]>(opinions ? [...opinions] : []);
	// svelte-ignore state_referenced_locally
	let panelVerdict = $state<Verdict | undefined>(verdict);
	let loading = $state(false);
	let unavailable = $state(false);
	let showTakes = $state(false);

	let done = $derived(takes.length > 0 && !!panelVerdict);
	// "1 open model" not "1 open models" — singular when exactly one panelist responded.
	let s = $derived(takes.length === 1 ? "" : "s");

	// Headline tone tracks the real cross-model agreement — the only honest per-answer
	// confidence signal. high = panel confirms the answer; low = panel disputes it.
	// Labels deliberately AVOID a verdict tone. "panel agrees" read as "confirmed true", but correlated
	// open models that share training lineage agreeing is a weak, non-independent signal (2026: a 9-model
	// cross-family panel ≈ ~2 effective independent votes; unanimous panels still wrong ~9% of the time).
	// So high agreement is "broadly aligned" (not "agrees"), and divergence — the more informative case —
	// keeps a plain, non-alarm label.
	const TONE: Record<Verdict["agreement"], { dot: string; text: string; label: string }> = {
		high: { dot: "var(--ap-live)", text: "var(--ap-live-text)", label: "broadly aligned" },
		mixed: { dot: "var(--ap-building)", text: "var(--ap-building-text)", label: "mixed views" },
		low: { dot: "var(--ap-gap)", text: "var(--ap-gap-text)", label: "they disagree" },
	};

	function flashRoute() {
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: [ROUTER_NODE] } }));
		}
	}

	async function getCollective() {
		const q = (question ?? "").trim();
		if (!q || loading) return;
		loading = true;
		unavailable = false;
		flashRoute();
		try {
			// Must include the SvelteKit `base` (= /chat in prod): a bare "/api/second-opinion"
			// resolves against the site root (aipotluck.org), not the chat mount, so on prod it hit
			// the main site → non-JSON → "unavailable". Locally base="" so it happened to work.
			const res = await fetch(`${base}/api/second-opinion`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ question: q, conversationId: $page.params.id, messageId }),
			});
			const data = await res.json();
			if (!data?.available || !Array.isArray(data.opinions) || !data.opinions.length) {
				unavailable = true;
				return;
			}
			takes = data.opinions as Opinion[];
			panelVerdict = data.verdict as Verdict;
		} catch {
			unavailable = true;
		} finally {
			loading = false;
		}
	}
</script>

{#if done && panelVerdict}
	<div
		class="py-2.5/40 mt-1.5 rounded-lg border border-[var(--ap-rule)] bg-[var(--ap-paper)]/60 px-3"
	>
		<!-- Verdict headline ON the primary answer — tone earned from cross-model agreement. -->
		<div class="flex items-start gap-2">
			<span
				class="mt-[5px] size-[8px] shrink-0 rounded-full"
				style="background: {TONE[panelVerdict.agreement].dot}"
			></span>
			<div class="min-w-0">
				<div
					class="font-mono text-[0.7rem] tracking-[0.08em]"
					style="color: {TONE[panelVerdict.agreement].text}"
				>
					Collective second opinion · {takes.length} open model{s} · {TONE[panelVerdict.agreement]
						.label}
				</div>
				<div class="mt-0.5 text-sm text-[var(--ap-ink)]">{panelVerdict.headline}</div>
				<!-- The caveat gets PARITY with the agreement headline (it used to hide in tiny italic at
				     the bottom): correlated models agreeing isn't independent verification. Salience must
				     match the claim, or the UI launders correlation into confidence. -->
				<div class="mt-1 text-[0.72rem] leading-snug text-[var(--ap-ink-3)]">
					{panelVerdict.agreement === "high"
						? "These open models share training lineage, so agreement is a signal — not proof. Read the takes before you rely on it."
						: panelVerdict.agreement === "low"
							? "They diverge — treat that as a reason to dig, not a verdict either way."
							: "Mixed signal — worth reading the takes and deciding for yourself."}
				</div>
			</div>
		</div>

		<!-- Agreement map: confirm / challenge / blind spots. Only non-empty sections show. -->
		{#if panelVerdict.consensus.length || panelVerdict.contradictions.length || panelVerdict.blindSpots.length}
			<div class="pt-2/70 mt-2 flex flex-col gap-2 border-t border-[var(--ap-rule)]/70">
				{#if panelVerdict.consensus.length}
					<div>
						<div class="font-mono text-[0.65rem] tracking-[0.08em] text-[var(--ap-live-text)]">
							They agree on
						</div>
						<ul class="mt-0.5 ml-3 list-disc text-[13px] text-[var(--ap-ink-2)]">
							{#each panelVerdict.consensus as c (c)}<li>{c}</li>{/each}
						</ul>
					</div>
				{/if}
				{#if panelVerdict.contradictions.length}
					<div>
						<div class="font-mono text-[0.65rem] tracking-[0.08em] text-[var(--ap-gap-text)]">
							Where they split
						</div>
						<ul class="mt-0.5 ml-3 list-disc text-[13px] text-[var(--ap-ink-2)]">
							{#each panelVerdict.contradictions as c (c)}<li>{c}</li>{/each}
						</ul>
					</div>
				{/if}
				{#if panelVerdict.blindSpots.length}
					<div>
						<div class="font-mono text-[0.65rem] tracking-[0.08em] text-[var(--ap-building-text)]">
							Blind spots
						</div>
						<ul class="mt-0.5 ml-3 list-disc text-[13px] text-[var(--ap-ink-2)]">
							{#each panelVerdict.blindSpots as c (c)}<li>{c}</li>{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Raw takes, one tap away — the summary above is a convenience OVER these. -->
		<button
			type="button"
			class="mt-2 text-[0.7rem] text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
			onclick={() => (showTakes = !showTakes)}
		>
			{showTakes ? "Hide" : "Show"} the {takes.length} individual take{s} ↓
		</button>
		{#if showTakes}
			<div class="pt-2/70 mt-1.5 flex flex-col gap-2 border-t border-[var(--ap-rule)]/70">
				{#each takes as take (take.model)}
					<div>
						<div class="mb-0.5 flex items-center gap-2 text-[0.7rem] text-[var(--ap-ink-3)]">
							<span class="font-medium text-[var(--ap-ink-2)]">{take.modelShort}</span>
							<span
								class="rounded-sm bg-amber-100 px-1 py-px text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
							>
								{take.openness}{take.sovereign ? "" : " · not sovereign"}
							</span>
						</div>
						<div class="prose prose-sm max-w-none text-sm dark:prose-invert">
							<MarkdownRenderer content={take.answer} />
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-2 text-[0.65rem] text-[var(--ap-ink-3)] italic">
			Automated summary over {takes.length} independent open model{s} — a cross-check on the answer above,
			not a source of truth. Convergence is more trustworthy; divergence is worth scrutiny. The models
			are not fully independent (some share lineage), so agreement is evidence, not proof.
		</div>
	</div>
{:else if loading}
	<div class="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[var(--ap-ink-3)]">
		<CarbonRenew class="animate-spin text-[0.7rem]" />
		Asking a panel of independent open models…
	</div>
{:else if unavailable}
	<div class="mt-1.5 text-xs text-[var(--ap-ink-3)] italic">
		Collective second opinion unavailable right now — this answer hasn't been cross-checked by other
		models.
	</div>
{:else if question}
	<button
		onclick={getCollective}
		class="group mt-1.5 inline-flex items-center gap-1.5 text-xs text-[var(--ap-ink-3)] transition-colors hover:text-[var(--ap-ink)]"
		title="Fan this question out to a panel of independent open models and see where they agree with, and challenge, the answer above."
	>
		<CarbonGroup class="text-[0.8rem]" />
		Get a collective second opinion
	</button>
{/if}
