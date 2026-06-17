<script lang="ts">
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import { tick } from "svelte";
	import { DropdownMenu } from "bits-ui";

	import LucideTrash2 from "~icons/lucide/trash-2";
	import LucideMoreHorizontal from "~icons/lucide/more-horizontal";
	import type { ConvSidebar } from "$lib/types/ConvSidebar";

	import DeleteConversationModal from "$lib/components/DeleteConversationModal.svelte";
	import { requireAuthUser } from "$lib/utils/auth";

	interface Props {
		conv: ConvSidebar;
		readOnly?: true;
		ondeleteConversation?: (id: string) => void;
		oneditConversationTitle?: (payload: { id: string; title: string }) => void;
	}

	let { conv, readOnly, ondeleteConversation, oneditConversationTitle }: Props = $props();

	let deleteOpen = $state(false);
	let isMenuOpen = $state(false);
	let inlineEditing = $state(false);
	let inlineCancelled = $state(false);
	let inlineTitle = $state("");
	let inputEl: HTMLInputElement | undefined = $state();

	let isActive = $derived(conv.id === page.params.id);

	async function startInlineEdit() {
		if (readOnly || requireAuthUser()) return;
		inlineTitle = conv.title;
		inlineCancelled = false;
		inlineEditing = true;
		await tick();
		inputEl?.focus();
		inputEl?.select();
	}

	function commitInlineEdit() {
		if (!inlineEditing || inlineCancelled) return;
		const trimmed = inlineTitle.trim();
		inlineEditing = false;
		if (trimmed && trimmed !== conv.title) {
			oneditConversationTitle?.({ id: conv.id.toString(), title: trimmed });
		}
	}

	function cancelInlineEdit() {
		inlineCancelled = true;
		inlineEditing = false;
	}
</script>

<div
	class="group flex h-8 flex-none items-center gap-1.5 rounded-none px-2 text-[13px] text-sidebar-foreground/50 transition-all duration-150 max-sm:h-10
		{isActive
		? 'border-b border-dashed border-sidebar-foreground/50 font-medium text-sidebar-foreground'
		: ''}"
>
	{#if inlineEditing}
		<input
			bind:this={inputEl}
			type="text"
			value={inlineTitle}
			oninput={(e) => (inlineTitle = (e.currentTarget as HTMLInputElement).value)}
			onkeydown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					commitInlineEdit();
				} else if (e.key === "Escape") {
					e.preventDefault();
					cancelInlineEdit();
				}
			}}
			onblur={commitInlineEdit}
			class="my-0 h-full min-w-0 flex-1 truncate border-none bg-transparent p-0 text-inherit outline-hidden first-letter:uppercase focus:ring-0"
		/>
	{:else}
		<a
			data-sveltekit-noscroll
			data-sveltekit-preload-data="tap"
			href="{base}/conversation/{conv.id}"
			class="min-w-0 flex-1 truncate py-2 first-letter:uppercase"
			onclick={(e) => {
				if (e.detail >= 2) {
					e.preventDefault();
					startInlineEdit();
				}
			}}
		>
			<span class="truncate">{conv.title}</span>
		</a>

		{#if !readOnly}
			<DropdownMenu.Root
				bind:open={isMenuOpen}
				onOpenChange={(open) => {
					if (open && requireAuthUser()) {
						isMenuOpen = false;
						return;
					}
					isMenuOpen = open;
				}}
			>
				<DropdownMenu.Trigger
					class="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors duration-150 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground md:hidden md:group-hover:flex md:data-[state=open]:flex"
					aria-label="Conversation actions"
					title="More options"
				>
					<LucideMoreHorizontal class="text-sm" />
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						class="z-50 min-w-36 rounded-xl border border-gray-200 bg-white/95 p-1 text-gray-800 shadow-lg backdrop-blur-sm"
						side="bottom"
						align="end"
						sideOffset={4}
						trapFocus={false}
						onCloseAutoFocus={(e) => e.preventDefault()}
						interactOutsideBehavior="defer-otherwise-close"
					>
						<DropdownMenu.Item
							class="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-red-500 select-none focus-visible:outline-hidden data-highlighted:bg-red-50 data-highlighted:text-red-600 sm:h-8"
							onSelect={() => (deleteOpen = true)}
						>
							<LucideTrash2 class="size-4 opacity-90" />
							Delete
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		{/if}
	{/if}
</div>

<!-- Delete confirmation modal -->
{#if deleteOpen}
	<DeleteConversationModal
		open={deleteOpen}
		title={conv.title}
		onclose={() => (deleteOpen = false)}
		ondelete={() => {
			deleteOpen = false;
			ondeleteConversation?.(conv.id.toString());
		}}
	/>
{/if}
