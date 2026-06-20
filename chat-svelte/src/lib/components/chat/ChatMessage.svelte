<script lang="ts">
	import type { Message } from "$lib/types/Message";
	import { tick } from "svelte";

	import CopyToClipBoardBtn from "../CopyToClipBoardBtn.svelte";
	import IconLoading from "../icons/IconLoading.svelte";
	import CarbonRotate360 from "~icons/carbon/rotate-360";
	// import CarbonDownload from "~icons/carbon/download";

	import CarbonPen from "~icons/carbon/pen";
	import CarbonCopy from "~icons/carbon/copy";
	import CarbonCheckmark from "~icons/carbon/checkmark";
	import UploadedFile from "./UploadedFile.svelte";

	import MarkdownRenderer from "./MarkdownRenderer.svelte";
	import { fixAcronymExpansions } from "$lib/utils/fixAcronyms";
	import OpenReasoningResults from "./OpenReasoningResults.svelte";
	import Alternatives from "./Alternatives.svelte";
	import MessageAvatar from "./MessageAvatar.svelte";
	import { requireAuthUser } from "$lib/utils/auth";
	import ArtifactCard from "./ArtifactCard.svelte";
	import { MessageUpdateType } from "$lib/types/MessageUpdate";
	import ImageLightbox from "./ImageLightbox.svelte";
	import ProvenanceTrace from "./ProvenanceTrace.svelte";
	import GapInvite from "./GapInvite.svelte";
	import type { StarterGap } from "$lib/constants/starterGaps";
	import ReportButton from "./ReportButton.svelte";
	import { splitArtifactSegments, stripArtifacts } from "$lib/utils/artifacts";
	import type { ArtifactOperation } from "$lib/utils/artifacts";

	interface Props {
		message: Message;
		loading?: boolean;
		isAuthor?: boolean;
		readOnly?: boolean;
		isTapped?: boolean;
		alternatives?: Message["id"][];
		editMsdgId?: Message["id"] | null;
		isLast?: boolean;
		// The conversation's served model id, used by the provenance badge to name
		// the model honestly. routerMetadata.model (per-answer) wins when present;
		// this is the fallback since we serve a single model with no Omni routing,
		// so routerMetadata is usually empty.
		modelId?: string;
		// The open-stack gap this answer's originating prompt deliberately surfaces, if any
		// (resolved by ChatWindow from the preceding user prompt; see starterGaps). Drives the
		// honest "touches a gap → get involved" CTA. Undefined for prompts that target no gap.
		gap?: StarterGap;
		onretry?: (payload: { id: Message["id"]; content?: string }) => void;
		onshowAlternateMsg?: (payload: { id: Message["id"] }) => void;
		// The user prompt this assistant answer responds to (resolved by ChatWindow from
		// the preceding message, like `gap`). Lets the user request an independent second
		// opinion on the same question. Undefined for user messages / no prior prompt.
		question?: string;
	}

	let {
		message,
		loading = false,
		isAuthor: _isAuthor = true,
		readOnly: _readOnly = false,
		isTapped = $bindable(false),
		alternatives = [],
		editMsdgId = $bindable(null),
		isLast = false,
		modelId,
		gap,
		question,
		onretry,
		onshowAlternateMsg,
	}: Props = $props();

	let contentEl: HTMLElement | undefined = $state();
	let isCopied = $state(false);
	let isUserMsgCopied = $state(false);
	let userCopyTimeout: ReturnType<typeof setTimeout>;
	let messageWidth: number = $state(0);
	let messageInfoWidth: number = $state(0);
	let lightboxSrc: string | null = $state(null);

	function handleContentClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === "IMG" && target instanceof HTMLImageElement) {
			e.preventDefault();
			e.stopPropagation();
			lightboxSrc = target.src;
		}
	}

	$effect(() => {
		// referenced to appease linter for currently-unused props
		void _isAuthor;
		void _readOnly;
	});
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			editFormEl?.requestSubmit();
		}
		if (e.key === "Escape") {
			editMsdgId = null;
		}
	}

	function handleCopy(event: ClipboardEvent) {
		if (!contentEl) return;

		const selection = window.getSelection();
		if (!selection || selection.isCollapsed) return;
		if (!selection.anchorNode || !selection.focusNode) return;

		const anchorInside = contentEl.contains(selection.anchorNode);
		const focusInside = contentEl.contains(selection.focusNode);
		if (!anchorInside && !focusInside) return;

		if (!event.clipboardData) return;

		const range = selection.getRangeAt(0);
		const wrapper = document.createElement("div");
		wrapper.appendChild(range.cloneContents());

		wrapper.querySelectorAll("[data-exclude-from-copy]").forEach((el) => {
			el.remove();
		});

		wrapper.querySelectorAll("*").forEach((el) => {
			el.removeAttribute("style");
			el.removeAttribute("class");
			el.removeAttribute("color");
			el.removeAttribute("bgcolor");
			el.removeAttribute("background");

			for (const attr of Array.from(el.attributes)) {
				if (attr.name === "id" || attr.name.startsWith("data-")) {
					el.removeAttribute(attr.name);
				}
			}
		});

		const html = wrapper.innerHTML;
		const text = wrapper.textContent ?? "";

		event.preventDefault();
		event.clipboardData.setData("text/html", html);
		event.clipboardData.setData("text/plain", text);
	}

	let editContentEl: HTMLTextAreaElement | undefined = $state();
	let editFormEl: HTMLFormElement | undefined = $state();

	// Zero-config reasoning autodetection: detect <think> blocks in content
	const THINK_BLOCK_REGEX = /(<think>[\s\S]*?(?:<\/think>|$))/gi;

	// Strip think blocks and artifact tags for clipboard copy (always, regardless of detection)
	let contentWithoutThink = $derived.by(() =>
		stripArtifacts(message.content.replace(THINK_BLOCK_REGEX, "")).trim()
	);

	// Feed the answer's open-web sources to the markdown renderer so inline [n] citation
	// markers become links to their source (addInlineCitations in utils/marked). Mapped from
	// SearchSource {n,title,url} to the renderer's {title,link} shape, in citation-number order.
	let citationSources = $derived(
		message.webSearch?.sources?.map((s) => ({ title: s.title, link: s.url })) ?? []
	);

	type Block =
		| { type: "text"; content: string }
		| { type: "think"; content: string; closed: boolean }
		| { type: "artifact"; op: ArtifactOperation; opIndex: number };

	type ProcessBlock = Extract<Block, { type: "think" }>;

	type RenderUnit =
		| { kind: "text"; content: string }
		| { kind: "group"; blocks: ProcessBlock[] }
		| { kind: "artifact"; op: ArtifactOperation; opIndex: number };

	// Expand any text block containing <think>…</think> into dedicated think blocks
	// so reasoning can be grouped/collapsed separately from the answer text.
	function expandThinkBlocks(input: Block[]): Block[] {
		const out: Block[] = [];
		for (const block of input) {
			if (block.type !== "text") {
				out.push(block);
				continue;
			}
			for (const part of block.content.split(THINK_BLOCK_REGEX)) {
				if (!part) continue;
				if (part.startsWith("<think>")) {
					const closed = part.endsWith("</think>");
					out.push({ type: "think", content: part.slice(7, closed ? -8 : undefined), closed });
				} else if (part.trim().length > 0) {
					out.push({ type: "text", content: part });
				}
			}
		}
		return out;
	}

	// Replace inline <artifact> blocks in text with dedicated artifact blocks that
	// render as cards (content lives in the artifact panel). Streaming-safe:
	// partially received tags are hidden until complete.
	function expandArtifactBlocks(input: Block[]): Block[] {
		const out: Block[] = [];
		let opIndex = 0;
		for (const block of input) {
			if (block.type !== "text") {
				out.push(block);
				continue;
			}
			for (const segment of splitArtifactSegments(block.content)) {
				if (segment.type === "artifact") {
					out.push({ type: "artifact", op: segment.op, opIndex: opIndex++ });
				} else if (segment.content.length > 0) {
					out.push({ type: "text", content: segment.content });
				}
			}
		}
		return collapseConsecutiveArtifactOps(out);
	}

	// Models sometimes emit several back-to-back operations on the same artifact
	// (e.g. one update block per find/replace pair). Every op still becomes a
	// version in the registry, but showing a card per op clutters the chat —
	// keep only the last card of each consecutive run.
	function collapseConsecutiveArtifactOps(input: Block[]): Block[] {
		const out: Block[] = [];
		for (const block of input) {
			if (block.type === "artifact") {
				let i = out.length - 1;
				while (i >= 0) {
					const prior = out[i];
					if (prior.type === "text" && prior.content.trim().length === 0) {
						i -= 1;
						continue;
					}
					if (prior.type === "artifact" && prior.op.identifier === block.op.identifier) {
						// Drop the earlier card (and the whitespace between) — this
						// later op supersedes it.
						out.splice(i, out.length - i);
					}
					break;
				}
			}
			out.push(block);
		}
		return out;
	}

	let blocks = $derived.by(() => {
		const updates = message.updates ?? [];
		const res: Block[] = [];
		let contentCursor = 0;
		let sawFinalAnswer = false;

		// Fast path: no updates at all
		if (updates.length === 0) {
			return expandArtifactBlocks(
				expandThinkBlocks(
					message.content ? [{ type: "text" as const, content: message.content }] : []
				)
			);
		}

		for (const update of updates) {
			if (update.type === MessageUpdateType.Stream) {
				const token =
					typeof update.token === "string" && update.token.length > 0 ? update.token : null;
				const len = token !== null ? token.length : (update.len ?? 0);
				const chunk =
					token ??
					(message.content ? message.content.slice(contentCursor, contentCursor + len) : "");
				contentCursor += len;
				if (!chunk) continue;
				const last = res.at(-1);
				if (last?.type === "text") last.content += chunk;
				else res.push({ type: "text" as const, content: chunk });
			} else if (update.type === MessageUpdateType.FinalAnswer) {
				sawFinalAnswer = true;
				const finalText = update.text ?? "";
				const currentText = res
					.filter((b) => b.type === "text")
					.map((b) => (b as { type: "text"; content: string }).content)
					.join("");

				let addedText = "";
				if (finalText.startsWith(currentText)) {
					addedText = finalText.slice(currentText.length);
				} else if (!currentText.endsWith(finalText)) {
					const needsGap = !/\n\n$/.test(currentText) && !/^\n/.test(finalText);
					addedText = (needsGap ? "\n\n" : "") + finalText;
				}

				if (addedText) {
					const last = res.at(-1);
					if (last?.type === "text") {
						last.content += addedText;
					} else {
						res.push({ type: "text" as const, content: addedText });
					}
				}
			}
		}

		// If content remains unmatched (e.g., persisted stream markers), append the remainder
		// Skip when a FinalAnswer already provided the authoritative text.
		if (!sawFinalAnswer && message.content && contentCursor < message.content.length) {
			const remaining = message.content.slice(contentCursor);
			if (remaining.length > 0) {
				const last = res.at(-1);
				if (last?.type === "text") last.content += remaining;
				else res.push({ type: "text" as const, content: remaining });
			}
		} else if (!res.some((b) => b.type === "text") && message.content) {
			// Fallback: no text produced at all
			res.push({ type: "text" as const, content: message.content });
		}

		return expandArtifactBlocks(expandThinkBlocks(res));
	});

	// Coalesce consecutive thinking blocks into groups so they can collapse into a
	// single "Thought" summary. Text passes through.
	let renderUnits = $derived.by(() => {
		const units: RenderUnit[] = [];
		let current: ProcessBlock[] | null = null;
		const flush = () => {
			if (current && current.length) {
				units.push({ kind: "group", blocks: current });
			}
			current = null;
		};
		for (const block of blocks) {
			if (block.type === "think") {
				(current ??= []).push(block);
			} else if (block.type === "artifact") {
				flush();
				units.push({ kind: "artifact", op: block.op, opIndex: block.opIndex });
			} else {
				flush();
				units.push({ kind: "text", content: block.content });
			}
		}
		flush();
		return units;
	});

	// Still mid-process (thinking / calling tools, no answer yet) → render the
	// blocks flat like today. Once the final answer starts streaming the last
	// block becomes text, so this flips to false and the nested summary takes over.
	let isProcessStreaming = $derived.by(() => {
		if (!isLast || !loading) return false;
		const last = blocks.at(-1);
		return !!last && last.type === "think";
	});

	$effect(() => {
		if (isCopied) {
			setTimeout(() => {
				isCopied = false;
			}, 1000);
		}
	});

	// Tailwind's `prose` resets font-size to 1rem while the app shell uses
	// `text-smd` (0.94rem); re-applying it here keeps answer text — and every
	// em-scaled child (code, pre, lists, tables, KaTeX) — in line with the rest
	// of the UI. Single source for both the streaming and final render branches.
	const proseClasses =
		"prose max-w-none text-smd dark:prose-invert prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-pre:bg-gray-800 prose-img:my-0 prose-img:cursor-pointer prose-img:rounded-lg dark:prose-pre:bg-gray-900";

	let editMode = $derived(editMsdgId === message.id);
	$effect(() => {
		if (editMode) {
			tick();
			if (editContentEl) {
				editContentEl.value = message.content;
				editContentEl?.focus();
			}
		}
	});
</script>

{#if message.from === "assistant"}
	<div
		bind:offsetWidth={messageWidth}
		class="group relative -mb-4 flex w-fit max-w-full items-start justify-start gap-4 pb-4 leading-relaxed max-sm:mb-1 {message.routerMetadata &&
		messageInfoWidth >= messageWidth
			? 'mb-1'
			: ''}"
		data-message-id={message.id}
		data-message-role="assistant"
		role="presentation"
		onclick={() => (isTapped = !isTapped)}
		onkeydown={() => (isTapped = !isTapped)}
	>
		<MessageAvatar
			classNames="mt-5 size-3.5 flex-none select-none rounded-full text-[var(--ap-ink)] max-sm:hidden"
			animating={isLast && loading}
		/>
		<div
			class="relative flex min-w-[60px] flex-col gap-2 rounded-2xl border border-gray-100 bg-linear-to-br from-gray-50 px-5 py-3.5 wrap-break-word text-gray-600 dark:border-gray-800 dark:from-gray-800/80 dark:text-gray-300 prose-pre:my-2"
		>
			{#if message.files?.length}
				<div class="flex h-fit flex-wrap gap-x-5 gap-y-2">
					{#each message.files as file (file.value)}
						<UploadedFile {file} canClose={false} />
					{/each}
				</div>
			{/if}

			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div bind:this={contentEl} oncopy={handleCopy} onclick={handleContentClick}>
				{#if isLast && loading && blocks.length === 0}
					<IconLoading classNames="loading inline ml-2 first:ml-0" />
				{/if}
				{#if isProcessStreaming}
					<!-- Streaming the thinking phase: render every block flat and
					     inline. Nesting kicks in once the answer starts. -->
					{#each blocks as block, blockIndex (`block-${blockIndex}`)}
						{#if block.type === "text"}
							{#if block.content.trim().length > 0}
								<div class={proseClasses}>
									<MarkdownRenderer
										content={fixAcronymExpansions(block.content)}
										sources={citationSources}
										loading={isLast && loading}
									/>
								</div>
							{/if}
						{:else if block.type === "artifact"}
							<ArtifactCard op={block.op} messageId={message.id} opIndex={block.opIndex} />
						{:else}
							<div data-exclude-from-copy class="not-last:mb-1 has-[+.prose]:mb-2! [.prose+&]:mt-3">
								<OpenReasoningResults
									content={block.content}
									loading={isLast && loading && !block.closed}
								/>
							</div>
						{/if}
					{/each}
				{:else}
					<!-- Answer started or generation finished: nest the process blocks. -->
					{#each renderUnits as unit, unitIndex (`${unit.kind}-${unitIndex}`)}
						{#if unit.kind === "text"}
							{#if isLast && loading && unit.content.length === 0}
								<IconLoading classNames="loading inline ml-2 first:ml-0" />
							{:else if unit.content.trim().length > 0}
								<div class={proseClasses}>
									<MarkdownRenderer
										content={fixAcronymExpansions(unit.content)}
										sources={citationSources}
										loading={isLast && loading}
									/>
								</div>
							{/if}
						{:else if unit.kind === "artifact"}
							<ArtifactCard op={unit.op} messageId={message.id} opIndex={unit.opIndex} />
						{:else if unit.kind === "group"}
							<div data-exclude-from-copy class="not-last:mb-1 has-[+.prose]:mb-2! [.prose+&]:mt-3">
								{#each unit.blocks as only, onlyIndex (`think-${onlyIndex}`)}
									<OpenReasoningResults content={only.content} loading={false} />
								{/each}
							</div>
						{/if}
					{/each}
				{/if}
			</div>

			<!-- The inline provenance TRACE: the stack diagram, inlined. One persistent spine
			     that draws itself segment-by-segment as each layer activates (retrieve → ground
			     → generate → verify) and STAYS DRAWN — a receipt that persists in scrollback,
			     mobile-native (single column, no split pane), and legible without a flash to
			     catch. It reuses the same honest per-layer badges (SourceStrip / SourceClass /
			     ProvenanceBadge / SafetyBadge / SecondOpinion) as its segment bodies, so the
			     honesty copy lives in one place. Reversible: revert this line + the `traced`
			     props to restore the flat badge stack. -->
			{#if message.from === "assistant"}
				<ProvenanceTrace {message} {modelId} {loading} {question} />
			{/if}

			<!-- Honest "touches an open gap → get involved" CTA. Only when this turn's prompt
			     deliberately surfaces a known gap (starterGaps) and the answer actually ran —
			     never on a safety decline (no answer to attach a gap to). -->
			{#if gap && !loading && message.content && !message.moderation?.flagged}
				<GapInvite {gap} />
			{/if}
		</div>

		{#if message.routerMetadata || (!loading && message.content)}
			<div
				class="absolute -bottom-3.5 {message.routerMetadata && messageInfoWidth > messageWidth
					? 'left-1 pl-1 @2xl:pl-7'
					: 'right-1'} flex max-w-[100cqw] items-center gap-0.5"
				bind:offsetWidth={messageInfoWidth}
			>
				<!-- HuggingChat's native route/model/provider pill is replaced by our
				editorial ProvenanceBadge (rendered inline below the answer). We serve a
				single Apertus model with no Omni routing, so the "route with model" UI
				never applied — and the badge's "show on map ↗" ties provenance to the
				live stack, which the pill could not. -->
				{#if !isLast || !loading}
					<CopyToClipBoardBtn
						onClick={() => {
							isCopied = true;
						}}
						classNames="btn inline-flex min-h-7 min-w-7 items-center justify-center rounded-xs p-1 text-sm text-gray-400 hover:text-gray-500 focus:ring-0 dark:text-gray-400 dark:hover:text-gray-300"
						value={contentWithoutThink}
						iconClassNames="text-xs"
					/>
					<button
						class="btn inline-flex min-h-7 min-w-7 items-center justify-center rounded-xs p-1 text-xs text-gray-400 hover:text-gray-500 focus:ring-0 dark:text-gray-400 dark:hover:text-gray-300"
						title="Retry"
						type="button"
						onclick={() => {
							onretry?.({ id: message.id });
						}}
					>
						<CarbonRotate360 />
					</button>
					<!-- Report a problem — present on every completed answer (docx P0); the Terms
					     page points users here. Flags route to saveReport (ROOST triage seam). -->
					<ReportButton messageId={message.id} />
					{#if alternatives.length > 1 && editMsdgId === null}
						<Alternatives
							{message}
							{alternatives}
							{loading}
							onshowAlternateMsg={(payload) => onshowAlternateMsg?.(payload)}
						/>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
	{#if lightboxSrc}
		<ImageLightbox src={lightboxSrc} onclose={() => (lightboxSrc = null)} />
	{/if}
{/if}
{#if message.from === "user"}
	<div
		class="group relative {alternatives.length > 1 && editMsdgId === null
			? 'mb-7'
			: ''} w-full items-start justify-start gap-4"
		data-message-id={message.id}
		data-message-type="user"
		role="presentation"
		onclick={() => (isTapped = !isTapped)}
		onkeydown={() => (isTapped = !isTapped)}
	>
		<div class="flex w-full flex-col gap-2">
			{#if message.files?.length}
				<div class="flex w-fit gap-4 px-5">
					{#each message.files as file}
						<UploadedFile {file} canClose={false} />
					{/each}
				</div>
			{/if}

			<div class="flex w-full flex-row flex-nowrap">
				{#if !editMode}
					<p
						class="disabled w-full appearance-none bg-inherit px-5 py-3.5 text-wrap wrap-break-word whitespace-break-spaces text-gray-500 dark:text-gray-400"
					>
						{message.content.trim()}
					</p>
				{:else}
					<form
						class="mt-3 flex w-full flex-col"
						bind:this={editFormEl}
						onsubmit={(e) => {
							e.preventDefault();
							onretry?.({ content: editContentEl?.value, id: message.id });
							editMsdgId = null;
						}}
					>
						<textarea
							class="w-full rounded-xl bg-gray-100 px-5 py-3.5 wrap-break-word whitespace-break-spaces text-gray-500 *:h-max focus:outline-hidden dark:bg-gray-800 dark:text-gray-400"
							rows="5"
							bind:this={editContentEl}
							value={message.content.trim()}
							onkeydown={handleKeyDown}
							required
						></textarea>
						<div class="flex w-full flex-row flex-nowrap items-center justify-center gap-2 pt-2">
							<button
								type="submit"
								class="btn rounded-lg px-3 py-1.5 text-sm
                                {loading
									? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
									: 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 focus:ring-0 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-200'}
								"
								disabled={loading}
							>
								Send
							</button>
							<button
								type="button"
								class="btn rounded-xs p-2 text-sm text-gray-400 hover:text-gray-500 focus:ring-0 dark:text-gray-400 dark:hover:text-gray-300"
								onclick={() => {
									editMsdgId = null;
								}}
							>
								Cancel
							</button>
						</div>
					</form>
				{/if}
			</div>
			<div class="absolute -bottom-4 ml-3.5 flex w-full items-center gap-1.5">
				{#if alternatives.length > 1 && editMsdgId === null}
					<Alternatives
						{message}
						{alternatives}
						{loading}
						onshowAlternateMsg={(payload) => onshowAlternateMsg?.(payload)}
					/>
				{/if}
				{#if (alternatives.length > 1 && editMsdgId === null) || (!loading && !editMode)}
					<button
						class="hidden h-5 cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-gray-400 group-hover:flex hover:flex hover:bg-gray-100 hover:text-gray-500 lg:-right-2 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						title="Edit"
						type="button"
						onclick={() => {
							if (requireAuthUser()) return;
							editMsdgId = message.id;
						}}
					>
						<CarbonPen />
						Edit
					</button>
					<button
						class="hidden h-5 cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs group-hover:flex hover:flex hover:bg-gray-100 lg:-right-2 dark:hover:bg-gray-800 {isUserMsgCopied
							? 'text-green-500 dark:text-green-400'
							: 'text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300'}"
						title="Copy to clipboard"
						type="button"
						onclick={async () => {
							try {
								if (window.isSecureContext && navigator.clipboard) {
									await navigator.clipboard.writeText(message.content);
								} else {
									const textArea = document.createElement("textarea");
									textArea.value = message.content;
									document.body.appendChild(textArea);
									textArea.focus();
									textArea.select();
									document.execCommand("copy");
									document.body.removeChild(textArea);
								}
								isUserMsgCopied = true;
								clearTimeout(userCopyTimeout);
								userCopyTimeout = setTimeout(() => {
									isUserMsgCopied = false;
								}, 1000);
							} catch (err) {
								console.error("Failed to copy:", err);
							}
						}}
					>
						{#if isUserMsgCopied}
							<CarbonCheckmark class="scale-[0.85]" />
							Copied
						{:else}
							<CarbonCopy class="scale-[0.85]" />
							Copy
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes loading {
		to {
			stroke-dashoffset: 122.9;
		}
	}
</style>
