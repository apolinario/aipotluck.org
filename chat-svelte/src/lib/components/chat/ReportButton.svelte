<script lang="ts">
	import { page } from "$app/state";
	import { base } from "$app/paths";
	import CarbonFlag from "~icons/carbon/flag";
	import CarbonCheckmark from "~icons/carbon/checkmark";

	// "Report a problem" — the flag control the docx requires on every session and the Terms
	// page points users to. Opens a small reason menu and POSTs to the conversation's report
	// endpoint (→ saveReport → ROOST triage seam). Reasons match the reports.reason enum.
	interface Props {
		messageId: string;
	}
	let { messageId }: Props = $props();

	const REASONS: { key: "harmful" | "inaccurate" | "privacy" | "other"; label: string }[] = [
		{ key: "harmful", label: "Harmful or unsafe" },
		{ key: "inaccurate", label: "Inaccurate or misleading" },
		{ key: "privacy", label: "Privacy or copyright" },
		{ key: "other", label: "Something else" },
	];

	let open = $state(false);
	let busy = $state(false);
	let done = $state(false);
	let failed = $state(false);

	async function submit(reason: string) {
		if (busy) return;
		busy = true;
		failed = false;
		try {
			const res = await fetch(`${base}/conversation/${page.params.id}/report`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messageId, reason }),
			});
			if (!res.ok) throw new Error(`report failed: ${res.status}`);
			done = true;
			setTimeout(() => {
				open = false;
				done = false;
			}, 1800);
		} catch (err) {
			console.error(err);
			failed = true;
		} finally {
			busy = false;
		}
	}
</script>

<div class="relative inline-flex">
	<button
		class="btn inline-flex min-h-7 min-w-7 items-center justify-center rounded-xs p-1 text-xs text-gray-400 hover:text-gray-500 focus:ring-0 dark:text-gray-400 dark:hover:text-gray-300"
		title="Report a problem"
		aria-label="Report a problem"
		type="button"
		onclick={() => (open = !open)}
	>
		<CarbonFlag />
	</button>

	{#if open}
		<!-- click-away backdrop -->
		<button
			class="fixed inset-0 z-10 cursor-default"
			aria-label="Close report menu"
			tabindex="-1"
			onclick={() => (open = false)}
		></button>
		<div
			class="absolute right-0 bottom-7 z-20 w-60 rounded-xl border border-[var(--ap-rule)] bg-[var(--ap-paper)] p-1.5 shadow-[var(--shadow-card)]"
			role="menu"
		>
			{#if done}
				<div class="flex items-center gap-2 px-2 py-2 text-xs text-[var(--ap-ink-2)]">
					<CarbonCheckmark class="text-[var(--ap-live)]" />
					Reported — thank you. The team reviews flags.
				</div>
			{:else}
				<p
					class="px-2 pt-1 pb-1.5 font-mono text-[10px] tracking-wide text-[var(--ap-ink-3)] uppercase"
				>
					Report this response
				</p>
				{#each REASONS as r (r.key)}
					<button
						class="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs text-[var(--ap-ink-2)] hover:bg-[var(--ap-rule)] disabled:opacity-50"
						type="button"
						role="menuitem"
						disabled={busy}
						onclick={() => submit(r.key)}
					>
						{r.label}
					</button>
				{/each}
				{#if failed}
					<p class="px-2 pt-1 text-xs text-[var(--ap-gap)]">Couldn't send — please try again.</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>
