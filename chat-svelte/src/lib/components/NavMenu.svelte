<script lang="ts" module>
	export const titles: { [key: string]: string } = {
		today: "Today",
		yesterday: "Yesterday",
		lastWeek: "Last 7 days",
		lastMonth: "Last 30 days",
		older: "Older",
	} as const;
</script>

<script lang="ts">
	import { base } from "$app/paths";
	import { goto } from "$app/navigation";

	import LucideMessageSquare from "~icons/lucide/message-square";
	import LucidePenSquare from "~icons/lucide/pen-square";
	import LucideTrash2 from "~icons/lucide/trash-2";
	import { isAborted } from "$lib/stores/isAborted";

	import NavConversationItem from "./NavConversationItem.svelte";
	import DeleteAllConversationsModal from "./DeleteAllConversationsModal.svelte";
	import type { LayoutData } from "../../routes/$types";
	import type { ConvSidebar } from "$lib/types/ConvSidebar";
	import { page } from "$app/state";
	import InfiniteScroll from "./InfiniteScroll.svelte";
	import { CONV_NUM_PER_PAGE } from "$lib/constants/pagination";
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";
	import { useAPIClient, handleResponse } from "$lib/APIClient";
	import { requireAuthUser } from "$lib/utils/auth";

	const publicConfig = usePublicConfig();
	const client = useAPIClient();

	interface Props {
		conversations: ConvSidebar[];
		user: LayoutData["user"];
		p?: number;
		/** When true, render the icon-only rail (labels + history hidden). */
		isCollapsed?: boolean;
		ondeleteConversation?: (id: string) => void;
		oneditConversationTitle?: (payload: { id: string; title: string }) => void;
		ondeleteAllConversations?: () => void;
	}

	let {
		conversations = $bindable(),
		user,
		p = $bindable(0),
		isCollapsed = false,
		ondeleteConversation,
		oneditConversationTitle,
		ondeleteAllConversations,
	}: Props = $props();

	let hasMore = $state(true);
	let deleteAllOpen = $state(false);

	function handleNewChatClick(e: MouseEvent) {
		isAborted.set(true);

		if (requireAuthUser()) {
			e.preventDefault();
			return;
		}

		e.preventDefault();
		goto(`${base}/`, { invalidateAll: true });
	}

	// Five date buckets mirroring prod groupChatsByDate (chat/components/chat/
	// sidebar-history.tsx): isToday, isYesterday, > oneWeekAgo, > oneMonthAgo, else older.
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
	const oneWeekAgo = new Date().setDate(new Date().getDate() - 7);
	const oneMonthAgo = new Date().setMonth(new Date().getMonth() - 1);

	let groupedConversations = $derived({
		today: conversations.filter(({ updatedAt }) => updatedAt.getTime() >= startOfToday),
		yesterday: conversations.filter(
			({ updatedAt }) =>
				updatedAt.getTime() >= startOfYesterday && updatedAt.getTime() < startOfToday
		),
		lastWeek: conversations.filter(
			({ updatedAt }) => updatedAt.getTime() < startOfYesterday && updatedAt.getTime() > oneWeekAgo
		),
		lastMonth: conversations.filter(
			({ updatedAt }) => updatedAt.getTime() <= oneWeekAgo && updatedAt.getTime() > oneMonthAgo
		),
		older: conversations.filter(({ updatedAt }) => updatedAt.getTime() <= oneMonthAgo),
	});

	let hasAnyConversation = $derived(conversations.length > 0);

	async function handleVisible() {
		p++;
		const newConvs = await client.conversations
			.get({
				query: {
					p,
				},
			})
			.then(handleResponse)
			.then((r) => r.conversations)
			.catch((): ConvSidebar[] => []);

		if (newConvs.length === 0) {
			hasMore = false;
		}

		conversations = [...conversations, ...newConvs];
	}

	$effect(() => {
		if (conversations.length <= CONV_NUM_PER_PAGE) {
			// reset p to 0 if there's only one page of content
			// that would be caused by a data loading invalidation
			p = 0;
		}
	});
</script>

<!-- Header: logo/home button (+ HuggingChat-only app name) -->
<div
	class="sticky top-0 flex flex-none touch-none items-center justify-between px-1.5 py-3 max-sm:pt-0"
>
	<a
		class="flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors duration-150 select-none hover:text-sidebar-foreground"
		href="{publicConfig.PUBLIC_ORIGIN}{base}/"
		title="Chatbot"
		aria-label="Chatbot"
	>
		<LucideMessageSquare class="size-4" />
	</a>
	{#if publicConfig.isHuggingChat}
		<span class="text-lg font-semibold select-none">{publicConfig.PUBLIC_APP_NAME}</span>
	{/if}
</div>

<!-- Content: New chat + Delete all -->
<div class="flex flex-col gap-px px-1.5 pt-1">
	<a
		href={`${base}/`}
		onclick={handleNewChatClick}
		class="flex h-8 items-center gap-2 rounded-lg border border-sidebar-border px-2 text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
		title="Ctrl/Cmd + Shift + O"
	>
		<LucidePenSquare class="size-4 shrink-0" />
		{#if !isCollapsed}
			<span class="font-medium">New chat</span>
		{/if}
	</a>
	{#if user?.username || user?.email}
		<button
			type="button"
			onclick={() => (deleteAllOpen = true)}
			class="flex h-8 items-center gap-2 rounded-lg px-2 text-sidebar-foreground/40 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
			title="Delete All Chats"
		>
			<LucideTrash2 class="size-4 shrink-0" />
			{#if !isCollapsed}
				<span class="text-[13px]">Delete all</span>
			{/if}
		</button>
	{/if}
</div>

<!-- History -->
{#if !isCollapsed}
	<div class="scrollbar-custom flex touch-pan-y flex-col gap-4 overflow-y-auto px-1.5 pt-3 pb-3">
		{#if hasAnyConversation}
			<div
				class="px-2 text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/70 uppercase"
			>
				History
			</div>
			{#each Object.entries(groupedConversations) as [group, convs]}
				{#if convs.length}
					<div class="flex flex-col">
						<div
							class="px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/70 uppercase"
						>
							{titles[group]}
						</div>
						{#each convs as conv}
							<NavConversationItem {conv} {oneditConversationTitle} {ondeleteConversation} />
						{/each}
					</div>
				{/if}
			{/each}
			{#if hasMore}
				<InfiniteScroll onvisible={handleVisible} />
			{/if}
		{:else}
			<div
				class="flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-sidebar-foreground/60"
			>
				{#if user?.username || user?.email}
					Your conversations will appear here once you start chatting!
				{:else}
					Login to save and revisit previous chats!
				{/if}
			</div>
		{/if}
	</div>
{/if}

{#if deleteAllOpen}
	<DeleteAllConversationsModal
		open={deleteAllOpen}
		onclose={() => (deleteAllOpen = false)}
		ondelete={() => {
			deleteAllOpen = false;
			ondeleteAllConversations?.();
		}}
	/>
{/if}
