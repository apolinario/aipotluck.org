<script lang="ts">
	// The "what happens after the chat" contribution paths, as real in-app forms writing to our own
	// DB. Two paths: "Stay informed" (subscribe → email only) and "Raise your hand" (contribute →
	// name / org / contribution type / detail). Svelte 5 port of the Vercel app's
	// components/chat/contribute-dialog.tsx, on the editorial paper theme (--ap-* tokens).
	import { untrack } from "svelte";
	import { base } from "$app/paths";
	import { error as errorStore } from "$lib/stores/errors";
	import Modal from "$lib/components/Modal.svelte";
	import { contributeOpen } from "$lib/stores/contribute";

	// Dialog-only: mounted ONCE at the ChatWindow top level and opened via the
	// `contributeOpen` store (any CTA flips it). Mounting at the top level — rather
	// than nested inside the welcome overlay — lets the Modal backdrop's intro play.

	const KINDS = [
		{ key: "subscribe", label: "Stay informed" },
		{ key: "contribute", label: "Raise your hand" },
	] as const;

	type Kind = (typeof KINDS)[number]["key"];

	const TYPES = [
		{ value: "compute", label: "Compute" },
		{ value: "data", label: "Data" },
		{ value: "code", label: "Code" },
		{ value: "funding", label: "Funding" },
		{ value: "other", label: "Other" },
	] as const;

	type ContributionType = (typeof TYPES)[number]["value"];

	let kind = $state<Kind>("subscribe");
	let email = $state("");
	let name = $state("");
	let organization = $state("");
	let contributionType = $state<ContributionType | null>(null);
	let detail = $state("");
	let submitting = $state(false);

	// Opened from a specific gap on the live-stack map ({ topic })? Jump to the
	// contribution form and name the gap — preserving the context the old mailto
	// subject carried. Guarded to the open transition so it never clobbers edits.
	let wasOpen = false;
	$effect(() => {
		const c = $contributeOpen;
		const isOpen = c !== false;
		untrack(() => {
			if (isOpen && !wasOpen && typeof c === "object") {
				kind = "contribute";
				detail = `Interested in: ${c.topic}`;
			}
			wasOpen = isOpen;
		});
	});

	// Shared field styling minus the corner radius — single-line inputs get a `rounded-full` pill,
	// the multi-line textarea gets `rounded-2xl`. Keep the radius OUT of the base: a textarea that
	// carried both `rounded-full` and `rounded-2xl` rendered as a full pill, because equal-specificity
	// radius utilities resolve by stylesheet order (rounded-full wins), not class-attribute order.
	const fieldBase =
		"w-full border border-[var(--ap-rule)] bg-transparent px-3 py-2 text-sm text-[var(--ap-ink)] placeholder:text-[var(--ap-ink-3)] outline-none focus:border-[var(--ap-ink)]";
	const inputClass = `${fieldBase} rounded-full`;
	const textareaClass = `${fieldBase} rounded-2xl`;

	function reset() {
		email = "";
		name = "";
		organization = "";
		contributionType = null;
		detail = "";
	}

	function closeDialog() {
		contributeOpen.set(false);
	}

	async function submit() {
		if (!email.trim()) {
			errorStore.set("An email is required so we can follow up.");
			return;
		}
		if (kind === "contribute" && !contributionType) {
			errorStore.set("Pick what you can contribute.");
			return;
		}
		submitting = true;
		try {
			const res = await fetch(`${base}/api/contribute`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					kind,
					email: email.trim(),
					name: name.trim() || null,
					organization: organization.trim() || null,
					contributionType: kind === "contribute" ? contributionType : null,
					detail: detail.trim() || null,
				}),
			});
			if (!res.ok) {
				throw new Error("contribute failed");
			}
			errorStore.set(
				kind === "subscribe"
					? "Thanks — we'll let you know when the beta launches."
					: "Thanks — we'll be in touch about contributing."
			);
			contributeOpen.set(false);
			reset();
		} catch {
			errorStore.set("Couldn't send that. Please try again.");
		} finally {
			submitting = false;
		}
	}
</script>

{#if $contributeOpen}
	<Modal width="max-w-md! m-4!" closeButton onclose={closeDialog}>
		<div class="flex w-full flex-col gap-4 bg-[var(--ap-paper)] px-6 py-6">
			<div class="flex flex-col gap-1.5">
				<h2 class="font-serif text-xl text-[var(--ap-ink)]">Get involved</h2>
				<p class="text-[13px] text-[var(--ap-ink-3)]">
					AI Potluck is a public utility built in the open. Leave a way to reach you, or tell us
					what you can bring.
				</p>
			</div>

			<div class="flex gap-1 rounded-full border border-[var(--ap-rule)] p-1">
				{#each KINDS as k (k.key)}
					<button
						type="button"
						class="flex-1 rounded-full py-1.5 font-mono text-[11px] tracking-[0.06em] uppercase transition-colors {kind ===
						k.key
							? 'bg-[var(--ap-ink)] text-[var(--ap-paper)]'
							: 'text-[var(--ap-ink-3)] hover:text-[var(--ap-ink)]'}"
						onclick={() => (kind = k.key)}
					>
						{k.label}
					</button>
				{/each}
			</div>

			<div class="flex flex-col gap-3">
				{#if kind === "contribute"}
					<div class="flex gap-2">
						<input class={inputClass} aria-label="Your name" placeholder="Name" bind:value={name} />
						<input
							class={inputClass}
							aria-label="Organisation"
							placeholder="Organisation"
							bind:value={organization}
						/>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each TYPES as t (t.value)}
							<button
								type="button"
								class="rounded-full border px-3 py-1.5 font-mono text-[11px] tracking-[0.06em] uppercase transition-colors {contributionType ===
								t.value
									? 'border-[var(--ap-ink)] bg-[var(--ap-ink)] text-[var(--ap-paper)]'
									: 'border-[var(--ap-rule)] text-[var(--ap-ink)] hover:bg-[var(--ap-ink)]/5'}"
								onclick={() => (contributionType = t.value)}
							>
								{t.label}
							</button>
						{/each}
					</div>
				{/if}

				<input
					class={inputClass}
					aria-label="Email"
					type="email"
					placeholder="you@organisation.org"
					bind:value={email}
				/>

				{#if kind === "contribute"}
					<textarea
						class={textareaClass}
						rows={3}
						maxlength={2000}
						placeholder="Anything else? (optional)"
						bind:value={detail}
					></textarea>
				{/if}

				<button
					type="button"
					disabled={submitting}
					onclick={submit}
					class="rounded-full bg-[var(--ap-ink)] px-4 py-2 font-mono text-[11px] tracking-[0.08em] text-[var(--ap-paper)] uppercase transition-opacity hover:opacity-85 disabled:opacity-60"
				>
					{submitting ? "Sending…" : kind === "subscribe" ? "Keep me posted" : "Send"}
				</button>

				<p class="text-center text-[11px] text-[var(--ap-ink-3)]/70">
					Building on the stack? API access is on the way — pick “Raise your hand” and say so.
				</p>
			</div>
		</div>
	</Modal>
{/if}
