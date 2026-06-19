<script lang="ts">
	import Modal from "$lib/components/Modal.svelte";
	import { base } from "$app/paths";
	import { blindSpotsOpen } from "$lib/stores/blindSpots";

	// The honest "blind spots" disclosure: the system's KNOWN, systematic weaknesses, stated
	// plainly. The whole product's thesis is the opposite of a tool that hides its limits — so
	// these are always available (a footer link), not a per-answer fabricated claim. Every item
	// is grounded in something real and is true regardless of the specific answer:
	//   • Recency — the persona's own recency rule: a fixed cutoff it CANNOT reliably date, so we
	//     never assert a date here either. Web search mitigates it per turn; without it, care.
	//   • Lookup isn't recall — the epistemics behind the source-class badges (PD-1): "looked it
	//     up" cites sources read just now; "from training" is recall, not a citation. Teaches the
	//     reader what the LOOKED IT UP / FROM TRAINING labels under each answer actually mean.
	//   • Language coverage — the launch demo prompts (Swahili / Wolof / Fon) exist to expose this.
	//   • One perspective — training data over-represents some countries/cultures, so the "default"
	//     answer can carry one viewpoint as if neutral. The cultural-skew axis, distinct from the
	//     language-quality axis above (deck p39 "one country = one perspective").
	//   • Not professional advice — Terms & Safety §1, verbatim domains.
	//   • It can be wrong — Terms §4 ("we do not guarantee accuracy… check, not just trust") +
	//     the single-model reality shown in the provenance badge.
	const close = () => blindSpotsOpen.set(false);

	const SPOTS: { title: string; body: string }[] = [
		{
			title: "Recency",
			body: "It has a fixed knowledge cutoff that it cannot reliably date, so it can be out of date on recent events. When a question needs current information it searches the open web and cites sources; without that, treat any “latest” or “newest” claim with care.",
		},
		{
			title: "Lookup isn’t recall",
			body: "When an answer is marked “looked it up,” it read open sources at that moment and cites them — you can open each one. When it is marked “from training,” it is recalling what it learned, not quoting a source. Recall can be confidently wrong; a citation is something you can check.",
		},
		{
			title: "Language coverage",
			body: "It is strongest in English and widely-resourced languages. Quality and accuracy drop in lower-resourced languages — a known gap in the open stack, not a guarantee of equal quality everywhere.",
		},
		{
			title: "One perspective",
			body: "Its training data over-represents some countries, cultures, and viewpoints, so its “default” answer can quietly carry one perspective as if it were neutral. On contested or culturally specific questions, ask whose view it is giving you.",
		},
		{
			title: "Not professional advice",
			body: "It is not a substitute for a doctor, lawyer, financial adviser, or mental-health professional. For anything high-stakes, verify with a qualified human.",
		},
		{
			title: "It can be wrong",
			body: "A single open model generates every answer. The model and its sources are named under each response on purpose — so you can check, not just trust.",
		},
	];
</script>

{#if $blindSpotsOpen}
	<Modal width="max-w-md! m-4!" closeButton onclose={close}>
		<div class="flex w-full flex-col gap-4 bg-[var(--ap-paper)] px-6 py-6">
			<div class="flex flex-col gap-1.5">
				<h2 class="font-serif text-xl text-[var(--ap-ink)]">Blind spots</h2>
				<p class="text-[13px] text-[var(--ap-ink-3)]">
					Where this system is systematically weak. We show these so you can weigh an answer rather
					than just take it &mdash; the opposite of a tool that hides its limits.
				</p>
			</div>
			<ul class="flex flex-col gap-3">
				{#each SPOTS as spot (spot.title)}
					<li class="flex flex-col gap-0.5">
						<span class="font-mono text-[11px] tracking-[0.06em] text-[var(--ap-ink)] uppercase"
							>{spot.title}</span
						>
						<span class="text-[13px] leading-relaxed text-[var(--ap-ink-3)]">{spot.body}</span>
					</li>
				{/each}
			</ul>
			<p class="text-[11px] text-[var(--ap-ink-3)]/70">
				More on data, safety, and how to flag a wrong answer is on the
				<a class="underline underline-offset-2 hover:text-[var(--ap-ink)]" href="{base}/terms"
					>Terms &amp; Safety</a
				> page.
			</p>
		</div>
	</Modal>
{/if}
