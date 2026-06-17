<script lang="ts">
	import { onMount, tick } from "svelte";

	import { afterNavigate } from "$app/navigation";

	import { DropdownMenu } from "bits-ui";
	import IconPlus from "~icons/lucide/plus";
	import IconGlobe from "~icons/lucide/globe";
	import IconLoaderCircle from "~icons/lucide/loader-circle";
	import CarbonImage from "~icons/carbon/image";
	import CarbonDocument from "~icons/carbon/document";
	import CarbonUpload from "~icons/carbon/upload";
	import CarbonLink from "~icons/carbon/link";
	import CarbonChevronRight from "~icons/carbon/chevron-right";
	import CarbonClose from "~icons/carbon/close";
	import UrlFetchModal from "./UrlFetchModal.svelte";
	import { TEXT_MIME_ALLOWLIST, IMAGE_MIME_ALLOWLIST_DEFAULT } from "$lib/constants/mime";

	import { isVirtualKeyboard } from "$lib/utils/isVirtualKeyboard";
	import { requireAuthUser } from "$lib/utils/auth";
	import { page } from "$app/state";

	interface Props {
		files?: File[];
		mimeTypes?: string[];
		value?: string;
		placeholder?: string;
		loading?: boolean;
		disabled?: boolean;
		// tools removed
		modelIsMultimodal?: boolean;
		// Whether the currently selected model supports tool calling (incl. overrides)
		modelSupportsTools?: boolean;
		// Open-web search composer toggle (the P0 differentiator). When the toggle
		// is shown, the user can ground a turn on Wikipedia + Marginalia.
		showWebSearch?: boolean;
		webSearchEnabled?: boolean;
		webSearching?: boolean;
		// Heuristic hint that the draft wants current info — nudges the globe so the
		// user notices the option. Never auto-enables; the user always decides.
		webSearchAffordance?: boolean;
		children?: import("svelte").Snippet;
		onPaste?: (e: ClipboardEvent) => void;
		focused?: boolean;
		onsubmit?: () => void;
	}

	let {
		files = $bindable([]),
		mimeTypes = [],
		value = $bindable(""),
		placeholder = "",
		loading = false,
		disabled = false,

		modelIsMultimodal = false,
		modelSupportsTools = true,
		showWebSearch = false,
		webSearchEnabled = $bindable(false),
		webSearching = false,
		webSearchAffordance = false,
		children,
		onPaste,
		focused = $bindable(false),
		onsubmit,
	}: Props = $props();

	const onFileChange = async (e: Event) => {
		if (!e.target) return;
		const target = e.target as HTMLInputElement;
		const selected = Array.from(target.files ?? []);
		if (selected.length === 0) return;
		files = [...files, ...selected];
		await tick();
		void focusTextarea();
	};

	let textareaElement: HTMLTextAreaElement | undefined = $state();
	let isCompositionOn = $state(false);
	let blurTimeout: ReturnType<typeof setTimeout> | null = $state(null);

	let fileInputEl: HTMLInputElement | undefined = $state();
	let isUrlModalOpen = $state(false);
	let isDropdownOpen = $state(false);

	function openPickerWithAccept(accept: string) {
		if (!fileInputEl) return;
		const allAccept = mimeTypes.join(",");
		fileInputEl.setAttribute("accept", accept);
		fileInputEl.click();
		queueMicrotask(() => fileInputEl?.setAttribute("accept", allAccept));
	}

	function openFilePickerText() {
		const textAccept =
			mimeTypes.filter((m) => !(m === "image/*" || m.startsWith("image/"))).join(",") ||
			TEXT_MIME_ALLOWLIST.join(",");
		openPickerWithAccept(textAccept);
	}

	function openFilePickerImage() {
		const imageAccept =
			mimeTypes.filter((m) => m === "image/*" || m.startsWith("image/")).join(",") ||
			IMAGE_MIME_ALLOWLIST_DEFAULT.join(",");
		openPickerWithAccept(imageAccept);
	}

	const waitForAnimationFrame = () =>
		typeof requestAnimationFrame === "function"
			? new Promise<void>((resolve) => {
					requestAnimationFrame(() => resolve());
				})
			: Promise.resolve();

	async function focusTextarea() {
		if (page.data.shared && page.data.loginEnabled && !page.data.user) return;
		if (!textareaElement || textareaElement.disabled || isVirtualKeyboard()) return;
		if (typeof document !== "undefined" && document.activeElement === textareaElement) return;

		await tick();

		if (typeof requestAnimationFrame === "function") {
			await waitForAnimationFrame();
			await waitForAnimationFrame();
		}

		if (!textareaElement || textareaElement.disabled || isVirtualKeyboard()) return;

		try {
			textareaElement.focus({ preventScroll: true });
		} catch {
			textareaElement.focus();
		}

		// Retry only when focus failed due to #app being inert (modal closing transition)
		if (
			typeof document !== "undefined" &&
			document.activeElement !== textareaElement &&
			document.getElementById("app")?.hasAttribute("inert")
		) {
			setTimeout(() => {
				if (!textareaElement || textareaElement.disabled || isVirtualKeyboard()) return;
				if (document.activeElement === textareaElement) return;
				try {
					textareaElement.focus({ preventScroll: true });
				} catch {
					textareaElement.focus();
				}
			}, 350);
		}
	}

	function handleFetchedFiles(newFiles: File[]) {
		if (!newFiles?.length) return;
		files = [...files, ...newFiles];
		queueMicrotask(async () => {
			await tick();
			void focusTextarea();
		});
	}

	onMount(() => {
		void focusTextarea();
	});

	afterNavigate(() => {
		void focusTextarea();
	});

	function adjustTextareaHeight() {
		if (!textareaElement) {
			return;
		}

		textareaElement.style.height = "auto";
		textareaElement.style.height = `${textareaElement.scrollHeight}px`;

		if (textareaElement.selectionStart === textareaElement.value.length) {
			textareaElement.scrollTop = textareaElement.scrollHeight;
		}
	}

	$effect(() => {
		if (!textareaElement) return;
		void value;
		adjustTextareaHeight();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (
			event.key === "Enter" &&
			!event.shiftKey &&
			!isCompositionOn &&
			!isVirtualKeyboard() &&
			value.trim() !== ""
		) {
			event.preventDefault();
			tick();
			onsubmit?.();
		}
	}

	function handleFocus() {
		if (requireAuthUser()) {
			return;
		}
		if (blurTimeout) {
			clearTimeout(blurTimeout);
			blurTimeout = null;
		}
		focused = true;
	}

	function handleBlur() {
		if (!isVirtualKeyboard()) {
			focused = false;
			return;
		}

		if (blurTimeout) {
			clearTimeout(blurTimeout);
		}

		blurTimeout = setTimeout(() => {
			blurTimeout = null;
			focused = false;
		});
	}

	// Show file upload when any mime is allowed (text always; images if multimodal)
	let showFileUpload = $derived(mimeTypes.length > 0);
	// The tools row renders when there's anything to put in it — file upload or
	// the web-search toggle.
	let showToolsRow = $derived(showFileUpload || showWebSearch);

	function toggleWebSearch() {
		if (requireAuthUser()) return;
		webSearchEnabled = !webSearchEnabled;
	}
</script>

<div class="flex min-h-full flex-1 flex-col" onpaste={onPaste}>
	<textarea
		rows="1"
		tabindex="0"
		inputmode="text"
		class="scrollbar-custom max-h-[4lh] w-full resize-none overflow-x-hidden overflow-y-auto border-0 bg-transparent px-2.5 py-2.5 outline-hidden focus:ring-0 focus-visible:ring-0 sm:px-3 md:max-h-[8lh]"
		class:text-gray-400={disabled}
		bind:value
		bind:this={textareaElement}
		onkeydown={handleKeydown}
		oncompositionstart={() => (isCompositionOn = true)}
		oncompositionend={() => (isCompositionOn = false)}
		{placeholder}
		{disabled}
		onfocus={handleFocus}
		onblur={handleBlur}
		onbeforeinput={requireAuthUser}
	></textarea>

	{#if showToolsRow}
		<div
			class={[
				"-ml-0.5 scrollbar-custom flex max-w-[calc(100%-40px)] flex-wrap items-center justify-start gap-2.5 px-3 pt-1.5 pb-2.5 text-gray-500 max-md:flex-nowrap max-md:overflow-x-auto sm:gap-2 dark:text-gray-400",
			]}
		>
			{#if showFileUpload}
				<div class="flex items-center">
					<input
						bind:this={fileInputEl}
						disabled={loading}
						class="absolute hidden size-0"
						aria-label="Upload file"
						type="file"
						multiple
						onchange={onFileChange}
						onclick={(e) => {
							if (requireAuthUser()) {
								e.preventDefault();
							}
						}}
						accept={mimeTypes.join(",")}
					/>

					<DropdownMenu.Root
						bind:open={isDropdownOpen}
						onOpenChange={(open) => {
							if (open && requireAuthUser()) {
								isDropdownOpen = false;
								return;
							}
							isDropdownOpen = open;
						}}
					>
						<DropdownMenu.Trigger
							class="btn size-8 rounded-full border bg-white text-black shadow-sm transition-none enabled:hover:bg-white enabled:hover:shadow-inner sm:size-7 dark:border-transparent dark:bg-gray-600/50 dark:text-white dark:hover:enabled:bg-gray-600"
							disabled={loading}
							aria-label="Add attachment"
						>
							<IconPlus class="text-base sm:text-sm" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Portal>
							<DropdownMenu.Content
								class="z-50 rounded-xl border border-gray-200 bg-white/95 p-1 text-gray-800 shadow-lg backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-800/95 dark:text-gray-100"
								side="top"
								sideOffset={8}
								align="start"
								trapFocus={false}
								onCloseAutoFocus={(e) => e.preventDefault()}
								interactOutsideBehavior="defer-otherwise-close"
							>
								{#if modelIsMultimodal}
									<DropdownMenu.Item
										class="flex h-9 items-center gap-1 rounded-md px-2 text-sm text-gray-700 select-none focus-visible:outline-hidden data-highlighted:bg-gray-100 sm:h-8 dark:text-gray-200 dark:data-highlighted:bg-white/10"
										onSelect={() => openFilePickerImage()}
									>
										<CarbonImage class="size-4 opacity-90 dark:opacity-80" />
										Add image(s)
									</DropdownMenu.Item>
								{/if}

								<DropdownMenu.Sub>
									<DropdownMenu.SubTrigger
										class="flex h-9 items-center gap-1 rounded-md px-2 text-sm text-gray-700 select-none focus-visible:outline-hidden data-highlighted:bg-gray-100 data-[state=open]:bg-gray-100 sm:h-8 dark:text-gray-200 dark:data-highlighted:bg-white/10 dark:data-[state=open]:bg-white/10"
									>
										<div class="flex items-center gap-1">
											<CarbonDocument class="size-4 opacity-90 dark:opacity-80" />
											Add text file
										</div>
										<div class="ml-auto flex items-center">
											<CarbonChevronRight class="size-4 opacity-70 dark:opacity-80" />
										</div>
									</DropdownMenu.SubTrigger>
									<DropdownMenu.SubContent
										class="z-50 rounded-xl border border-gray-200 bg-white/95 p-1 text-gray-800 shadow-lg backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-800/95 dark:text-gray-100"
										sideOffset={10}
										trapFocus={false}
										onCloseAutoFocus={(e) => e.preventDefault()}
										interactOutsideBehavior="defer-otherwise-close"
									>
										<DropdownMenu.Item
											class="flex h-9 items-center gap-1 rounded-md px-2 text-sm text-gray-700 select-none focus-visible:outline-hidden data-highlighted:bg-gray-100 sm:h-8 dark:text-gray-200 dark:data-highlighted:bg-white/10"
											onSelect={() => openFilePickerText()}
										>
											<CarbonUpload class="size-4 opacity-90 dark:opacity-80" />
											Upload from device
										</DropdownMenu.Item>
										<DropdownMenu.Item
											class="flex h-9 items-center gap-1 rounded-md px-2 text-sm text-gray-700 select-none focus-visible:outline-hidden data-highlighted:bg-gray-100 sm:h-8 dark:text-gray-200 dark:data-highlighted:bg-white/10"
											onSelect={() => (isUrlModalOpen = true)}
										>
											<CarbonLink class="size-4 opacity-90 dark:opacity-80" />
											Fetch from URL
										</DropdownMenu.Item>
									</DropdownMenu.SubContent>
								</DropdownMenu.Sub>
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				</div>
			{/if}

			{#if showWebSearch}
				<button
					type="button"
					onclick={toggleWebSearch}
					disabled={loading}
					aria-pressed={webSearchEnabled}
					aria-label="Search open sources for current info"
					title="Ground the answer on open sources (Wikipedia + Marginalia)"
					class="flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors sm:h-7 {webSearchEnabled
						? 'border-blue-500/40 bg-blue-50 text-blue-600 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-300'
						: webSearchAffordance
							? 'animate-pulse border-blue-400/50 bg-white text-blue-500 dark:border-blue-400/30 dark:bg-gray-600/50 dark:text-blue-300'
							: 'border-transparent bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:bg-gray-600/50 dark:text-gray-300 dark:hover:bg-gray-600'}"
				>
					{#if webSearching}
						<IconLoaderCircle class="size-3.5 animate-spin" />
						<span>Searching…</span>
					{:else}
						<IconGlobe class="size-3.5" />
						<span>{webSearchEnabled ? "Open search on" : "Open search"}</span>
					{/if}
				</button>
			{/if}
		</div>
	{/if}
	{@render children?.()}

	<UrlFetchModal
		bind:open={isUrlModalOpen}
		acceptMimeTypes={mimeTypes}
		onfiles={handleFetchedFiles}
	/>
</div>

<style>
	/* In the base layer so utility classes (font-mono, text-xs, prose) keep
	   winning over these element selectors, as they did before Tailwind v4 */
	@layer base {
		:global(pre),
		:global(textarea) {
			font-family: inherit;
			box-sizing: border-box;
			line-height: 1.5;
			font-size: 16px;
		}
	}
</style>
