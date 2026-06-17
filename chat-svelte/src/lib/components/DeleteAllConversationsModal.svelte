<script lang="ts">
	import Modal from "$lib/components/Modal.svelte";
	import { onMount } from "svelte";

	interface Props {
		open?: boolean;
		onclose?: () => void;
		ondelete?: () => void;
	}

	let { open = false, onclose, ondelete }: Props = $props();

	let deleteButtonEl: HTMLButtonElement | undefined = $state();

	function close() {
		open = false;
		onclose?.();
	}

	function confirmDelete() {
		ondelete?.();
		close();
	}

	onMount(() => {
		setTimeout(() => {
			deleteButtonEl?.focus();
		}, 100);
	});
</script>

{#if open}
	<Modal onclose={close} width="w-[90dvh] md:w-[480px]">
		<div class="flex w-full flex-col gap-5 bg-[var(--ap-paper)] p-6">
			<div class="flex items-start justify-between">
				<h2 class="text-lg font-semibold text-[var(--ap-ink)]">Delete all chats?</h2>
				<button type="button" class="group outline-hidden" onclick={close} aria-label="Close">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 32 32"
						class="size-5 text-[var(--ap-ink-3)] group-hover:text-[var(--ap-ink)]"
						><path
							d="M24 9.41 22.59 8 16 14.59 9.41 8 8 9.41 14.59 16 8 22.59 9.41 24 16 17.41 22.59 24 24 22.59 17.41 16 24 9.41z"
							fill="currentColor"
						/></svg
					>
				</button>
			</div>

			<p class="text-sm text-[var(--ap-ink-2)]">
				This action cannot be undone. This will permanently delete all your chats and remove them
				from our servers.
			</p>

			<div class="flex items-center justify-end gap-2">
				<button
					type="button"
					class="inline-flex items-center rounded-xl border border-[var(--ap-rule)] bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--ap-ink)] outline-hidden transition-colors hover:bg-[var(--ap-ink)]/5"
					onclick={close}
				>
					Cancel
				</button>
				<button
					bind:this={deleteButtonEl}
					type="button"
					class="inline-flex items-center rounded-xl border border-[var(--ap-gap)] bg-[var(--ap-gap)] px-3 py-1.5 text-sm font-semibold text-white outline-hidden transition-opacity hover:opacity-90 focus:ring-2 focus:ring-[var(--ap-gap)]/40 focus:ring-offset-2"
					onclick={confirmDelete}
				>
					Delete All
				</button>
			</div>
		</div>
	</Modal>
{/if}
