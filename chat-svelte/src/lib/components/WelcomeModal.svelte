<script lang="ts">
	import Modal from "$lib/components/Modal.svelte";
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";

	const publicConfig = usePublicConfig();

	interface Props {
		close: () => void;
	}

	let { close }: Props = $props();
</script>

<Modal closeOnBackdrop={false} onclose={close} width="max-w-[420px]! m-4!">
	<div
		class="flex w-full flex-col gap-8 bg-white bg-linear-to-b to-transparent px-6 pb-7 dark:bg-black dark:from-white/10 dark:to-white/5"
	>
		<div
			class="relative -mx-6 grid h-40 place-items-center overflow-hidden rounded-b-xl bg-linear-to-t from-black/5 select-none dark:from-white/10"
		>
			<h2
				class="flex translate-y-1 items-center gap-2.5 px-6 text-center text-2xl font-semibold text-gray-900 dark:text-gray-100"
			>
				<img class="size-10 dark:invert" src="{publicConfig.assetPath}/logo.svg" alt="" />
				{publicConfig.PUBLIC_APP_NAME}
			</h2>
		</div>

		<div class="text-gray-700 dark:text-gray-200">
			<p class="text-[15px] leading-relaxed">
				Welcome to {publicConfig.PUBLIC_APP_NAME} — a chat app built on the open AI ecosystem, served
				on public infrastructure.
			</p>
			<p class="mt-3 text-[15px] leading-relaxed">
				Every answer is transparent about how it was made: the badge below each reply shows the model,
				who built it, and who served it. Tap <span class="font-medium">show on map ↗</span> or
				<span class="font-medium">Under the hood</span> to see the full open stack behind your chat.
			</p>
			<p class="mt-3 text-[15px] leading-relaxed">
				Turn on <span class="font-medium">Open search</span> to ground answers in open, citable sources.
			</p>
		</div>

		<button
			class="k w-full rounded-xl bg-black px-5 py-2.5 text-base font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
			onclick={close}
		>
			Start chatting
		</button>
	</div>
</Modal>
