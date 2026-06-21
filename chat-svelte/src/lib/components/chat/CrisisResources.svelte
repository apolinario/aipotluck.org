<script lang="ts">
	import CarbonFavorite from "~icons/carbon/favorite";

	// Compassionate, additive crisis-resource card — shown when the user's message trips an
	// unambiguous self-harm/suicidal-ideation signal (src/lib/crisis.ts, client-side, stores nothing).
	// It NEVER replaces or blocks the model's answer; it sits at the top of the reply so real help is
	// the first thing a person in distress sees. Resources mirror the persona's own guidance exactly
	// (988 + findahelpline.com), so the card and the model speak with one voice.
	//
	// Tone: calm and plain, not alarm. Deliberately NOT gap-red (reads as error) and NOT the coral CTA
	// colour (reserved for "contribute"); a quiet supportive card. Honest about being an automated demo
	// pointer, not a diagnosis or a substitute for a person.
</script>

<div
	class="mb-3 rounded-xl border border-[var(--ap-rule)] bg-[var(--ap-paper)]/70 px-4 py-3 text-[var(--ap-ink-2)]"
	role="note"
	aria-label="Support resources"
>
	<div class="flex items-start gap-2.5">
		<CarbonFavorite class="mt-0.5 size-4 shrink-0 text-[var(--ap-ink-2)]" aria-hidden="true" />
		<div class="min-w-0 text-[13px] leading-relaxed">
			<p class="text-[var(--ap-ink)]">
				If things feel overwhelming, you don't have to face it alone. These connect you with trained
				people — free and confidential:
			</p>
			<ul class="mt-1.5 space-y-1">
				<li>
					<a
						class="font-medium text-[var(--ap-ink)] underline underline-offset-2 hover:text-[var(--ap-coral-text)]"
						href="https://988lifeline.org"
						target="_blank"
						rel="noreferrer">988 Suicide &amp; Crisis Lifeline</a
					>
					<span class="text-[var(--ap-ink-3)]">— US: call or text 988</span>
				</li>
				<li>
					<a
						class="font-medium text-[var(--ap-ink)] underline underline-offset-2 hover:text-[var(--ap-coral-text)]"
						href="https://findahelpline.com"
						target="_blank"
						rel="noreferrer">findahelpline.com</a
					>
					<span class="text-[var(--ap-ink-3)]">— free, confidential lines in your country</span>
				</li>
			</ul>
			<p class="mt-1.5 text-[12px] text-[var(--ap-ink-3)]">
				If you're in immediate danger, use your local emergency number. This is an automated pointer
				shown by a demo — a way to reach real people, not a diagnosis or a substitute for one.
			</p>
		</div>
	</div>
</div>
