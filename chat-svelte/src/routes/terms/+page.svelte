<script lang="ts">
	const UPDATED = "2026-06-15";
</script>

<svelte:head>
	<title>Terms &amp; Safety — AI Potluck</title>
	<meta
		name="description"
		content="Terms of use and safety practices for the AI Potluck open alpha."
	/>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-16 leading-relaxed text-[var(--ap-ink)]">
	<a
		class="font-mono text-[12px] text-[var(--ap-coral)] underline-offset-2 hover:underline"
		href="/"
	>
		← back to the chat
	</a>

	<h1 class="terms-title mt-6 text-4xl font-light tracking-tight">Terms &amp; Safety</h1>
	<p class="mt-2 font-mono text-[12px] text-[var(--ap-ink-3)]">
		Open alpha · last updated {UPDATED}
	</p>

	<section class="mt-8 space-y-3">
		<h2 class="text-lg font-medium">What this is</h2>
		<p class="text-[var(--ap-ink-2)]">
			AI Potluck is an open, public demonstrator. The core already runs on an open model and
			sovereign public compute; the rest of the stack — search, safety, routing, and more — is being
			assembled in the open. The “Under the hood” panel shows what is live, what is still being
			built, and where the gaps remain. It is an early alpha, not a finished product. Answers can be
			wrong; verify anything important.
		</p>
	</section>

	<section class="mt-8 space-y-3">
		<h2 class="text-lg font-medium">Acceptable use</h2>
		<p class="text-[var(--ap-ink-2)]">
			Do not use this service to create, solicit, or distribute content that is illegal, that
			sexually exploits or endangers children, that harasses or threatens others, or that is
			designed to cause harm. Automated or high-volume scraping of the endpoint is not permitted.
		</p>
	</section>

	<section class="mt-8 space-y-3">
		<h2 class="text-lg font-medium">Safety &amp; moderation</h2>
		<p class="text-[var(--ap-ink-2)]">
			Being honest about what exists: today’s request-path safety is an open toxicity classifier (<span
				class="font-medium">toxic-bert</span
			>, Apache-2.0) that screens every message before it reaches the model and can decline abusive
			ones. Broader moderation — built on <span class="font-medium">ROOST</span> tooling — is on the
			roadmap and shown as <span class="font-mono text-[13px]">building</span> in the stack map, not yet
			running. Every answer also has a “Report a problem” control, and reports are stored for the team
			to review.
		</p>
	</section>

	<section class="mt-8 space-y-3">
		<h2 class="text-lg font-medium">Reporting a problem</h2>
		<p class="text-[var(--ap-ink-2)]">
			Use the “Report a problem” control beneath any response to flag it — harmful or unsafe
			content, inaccuracy, or a privacy concern. You can also reach the team at <a
				class="text-[var(--ap-coral)] underline-offset-2 hover:underline"
				href="mailto:contact@aipotluck.org">contact@aipotluck.org</a
			>.
		</p>
	</section>

	<section class="mt-8 space-y-3">
		<h2 class="text-lg font-medium">Data</h2>
		<p class="text-[var(--ap-ink-2)]">
			Conversations are stored to operate the service, and guest conversations are automatically
			deleted after 30 days. Do not enter sensitive personal information. See the <a
				class="text-[var(--ap-coral)] underline-offset-2 hover:underline"
				href="/privacy">Privacy</a
			> page for details.
		</p>
	</section>
</main>

<style>
	/* The global h1/h2 rule in main.css is unlayered (font-weight: 400) and beats
	   Tailwind's layered `font-light` utility. Prod's terms H1 renders at weight 300
	   because prod's equivalent rule lives in @layer base. Force 300 here to match. */
	.terms-title {
		font-weight: 300;
	}
</style>
