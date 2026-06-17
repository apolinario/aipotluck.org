<script lang="ts">
	// Ported 1:1 from the prod /chat privacy page (chat/app/privacy/page.tsx). Replaces the inherited
	// HuggingChat PRIVACY.md, which contradicted the product (HF-account sign-in, Hugging Face as data
	// controller, SOC 2, chat-ui GitHub). This is the AI Potluck open-alpha statement: guest/no-account,
	// Current AI nonprofit, env-synced retention, no-sell / no-train-without-consent.
	const UPDATED = "2026-06-15";
	// Retention window the privacy claim rests on. Prod single-sources this from LIMITS.retentionDays.
	// NOTE (follow-up): the chat-svelte TTL cron currently GCs sessions/messageEvents/etc. but NOT
	// conversations — a conversation-retention sweep is required to make the "deleted after N days"
	// claim literally true. Tracked in alpha-spec-checklist.
	const RETENTION_DAYS = 30;
</script>

<svelte:head>
	<title>Privacy — AI Potluck</title>
	<meta name="description" content="How AI Potluck handles your data during the open alpha." />
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-16 leading-relaxed text-[var(--ap-ink)]">
	<a
		class="font-mono text-[12px] text-[var(--ap-coral)] underline-offset-2 hover:underline"
		href="/"
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
			This is an open alpha run by Current AI, a nonprofit coalition — not a company — and a fuller
			privacy statement will follow at public launch.
		</p>
	</section>

	<p class="mt-10 font-mono text-[12px] text-[var(--ap-ink-3)]">
		See also <a class="text-[var(--ap-coral)] underline-offset-2 hover:underline" href="/terms"
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
