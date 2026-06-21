<script lang="ts">
	// Ported 1:1 from the prod /chat privacy page (chat/app/privacy/page.tsx). Replaces the inherited
	// HuggingChat PRIVACY.md, which contradicted the product (HF-account sign-in, Hugging Face as data
	// controller, SOC 2, chat-ui GitHub). This is the AI Potluck open-alpha statement: guest/no-account,
	// Current AI nonprofit, env-synced retention, no-sell / no-train-without-consent.
	import { RETENTION_DAYS } from "$lib/constants/retention";
	const UPDATED = "2026-06-15";
	// RETENTION_DAYS is the SAME value the server actually sweeps on (db/cleanup.ts) — single-sourced so
	// the "deleted after N days" claim below can't drift from the mechanism that enforces it.
</script>

<svelte:head>
	<title>Privacy — AI Potluck</title>
	<meta name="description" content="How AI Potluck handles your data during the open alpha." />
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-16 leading-relaxed text-[var(--ap-ink)]">
	<a
		class="font-mono text-[12px] text-[var(--ap-coral-text)] underline-offset-2 hover:underline"
		href="/"
		onclick={(e) => {
			// Return to wherever the reader came from (e.g. their conversation) instead of a fresh
			// landing; fall back to "/" (the href) when there's no in-app history (direct visit).
			if (typeof history !== "undefined" && history.length > 1) {
				e.preventDefault();
				history.back();
			}
		}}
	>
		← back to the chat
	</a>

	<h1 class="privacy-title mt-6 text-4xl font-light tracking-tight">Privacy</h1>
	<p class="mt-2 font-mono text-[12px] text-[var(--ap-ink-3)]">
		Open alpha · last updated {UPDATED}
	</p>

	<section class="mt-8 space-y-4 text-[var(--ap-ink-2)]">
		<p>
			AI Potluck stores your conversations only to operate the service — to show you your own chat
			history and to keep the service running — and you use it as a guest, with no account or
			personal details required.
		</p>
		<p>
			Please do not enter sensitive personal information; guest conversations are automatically
			deleted after {RETENTION_DAYS} days.
		</p>
		<p>
			We do not sell your data, and we do not use your conversations to train models without your
			consent.
		</p>
		<p>
			If you choose to leave your details through “Get involved” — an email, and optionally your
			name and organisation — we store them only to follow up with you about the project, and we do
			not sell them. We don't keep the raw IP address of those submissions: it is hashed with a
			secret key and used only to limit abuse, never to identify you.
		</p>
		<p>
			This is an open alpha run by Current AI, a nonprofit coalition — not a company — and a fuller
			privacy statement will follow at public launch.
		</p>
	</section>

	<p class="mt-10 font-mono text-[12px] text-[var(--ap-ink-3)]">
		See also <a class="text-[var(--ap-coral-text)] underline-offset-2 hover:underline" href="/terms"
			>Terms &amp; Safety</a
		>.
	</p>
</main>

<style>
	/* Match prod's `font-light` (weight 300) on the display H1; the global h1 rule forces 400 unlayered. */
	.privacy-title {
		font-family: var(--font-serif);
		font-weight: 300;
	}
</style>
