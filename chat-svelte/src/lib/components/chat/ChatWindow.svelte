<script lang="ts">
	import type { Message, MessageFile } from "$lib/types/Message";
	import type { SearchContext } from "$lib/types/Search";
	import { isRecencyQueryDenoised } from "$lib/search/recency";
	import { tick } from "svelte";

	import ArtifactPanel from "./ArtifactPanel.svelte";
	import StackMap from "$lib/components/stack/StackMap.svelte";
	import { MODEL_NODES, COMPUTE_NODE } from "../stack/reveal";
	import { resolveServing } from "$lib/servingProvenance";
	import { collectArtifacts } from "$lib/utils/artifacts";
	import { setArtifactsContext } from "$lib/utils/artifactsContext";
	import { artifactPanel } from "$lib/stores/artifactPanel.svelte";

	import CarbonDirectionRight from "~icons/carbon/direction-right-01";
	import CarbonClose from "~icons/carbon/close";
	import IconArrowUp from "~icons/lucide/arrow-up";
	import IconPanelRight from "~icons/lucide/panel-right";

	import ChatInput from "./ChatInput.svelte";
	import WelcomeModal from "$lib/components/WelcomeModal.svelte";
	import ContributeDialog from "./ContributeDialog.svelte";
	import BlindSpotsModal from "./BlindSpotsModal.svelte";
	import { blindSpotsOpen } from "$lib/stores/blindSpots";
	import { stackOpen } from "$lib/stores/stack";
	import ShareButton from "./ShareButton.svelte";
	import { downloadConversationMarkdown } from "$lib/utils/exportConversation";
	import VoiceRecorder from "./VoiceRecorder.svelte";
	import StopGeneratingBtn from "../StopGeneratingBtn.svelte";
	import type { Model } from "$lib/types/Model";
	import FileDropzone from "./FileDropzone.svelte";
	import RetryBtn from "../RetryBtn.svelte";
	import file2base64 from "$lib/utils/file2base64";
	import { base } from "$app/paths";
	import { resolveModelIdentity } from "$lib/identity";
	import ChatMessage from "./ChatMessage.svelte";
	import ConnectionStatus from "./ConnectionStatus.svelte";
	import ScrollToBottomBtn from "../ScrollToBottomBtn.svelte";
	import ScrollToPreviousBtn from "../ScrollToPreviousBtn.svelte";
	import { browser } from "$app/environment";
	import { snapScrollToBottom } from "$lib/actions/snapScrollToBottom";
	import SystemPromptModal from "../SystemPromptModal.svelte";
	import ChatIntroduction from "./ChatIntroduction.svelte";
	import UploadedFile from "./UploadedFile.svelte";
	import { useSettingsStore } from "$lib/stores/settings";
	import { error } from "$lib/stores/errors";
	import ModelSwitch from "./ModelSwitch.svelte";
	import { routerExamples } from "$lib/constants/routerExamples";
	import type { RouterFollowUp, RouterExample } from "$lib/constants/routerExamples";
	import { gapForPrompt } from "$lib/constants/starterGaps";
	import FeatureAnnouncementToast from "../FeatureAnnouncementToast.svelte";
	import { getActiveAnnouncement } from "$lib/utils/featureAnnouncements";
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";
	import { pendingChatInput } from "$lib/stores/pendingChatInput";
	import LucideSparkles from "~icons/lucide/sparkles";

	import { fly, fade } from "svelte/transition";
	import { cubicInOut } from "svelte/easing";

	import { isVirtualKeyboard } from "$lib/utils/isVirtualKeyboard";
	import { requireAuthUser } from "$lib/utils/auth";
	import { tap, error as hapticError } from "$lib/utils/haptics";
	import { page } from "$app/state";

	interface Props {
		messages?: Message[];
		messagesAlternatives?: Message["id"][][];
		loading?: boolean;
		pending?: boolean;
		shared?: boolean;
		currentModel: Model;
		models: Model[];
		preprompt?: string | undefined;
		files?: File[];
		onmessage?: (content: string, opts?: { searchContext?: SearchContext }) => void;
		onstop?: () => void;
		onretry?: (payload: { id: Message["id"]; content?: string }) => void;
		onshowAlternateMsg?: (payload: { id: Message["id"] }) => void;
		draft?: string;
	}

	let {
		messages = [],
		messagesAlternatives = [],
		loading = false,
		pending = false,
		shared = false,
		currentModel,
		models,
		preprompt = undefined,
		files = $bindable([]),
		draft = $bindable(""),
		onmessage,
		onstop,
		onretry,
		onshowAlternateMsg,
	}: Props = $props();

	let isReadOnly = $derived(!models.some((model) => model.id === currentModel.id));

	// Friendly model name for the in-composer indicator — DERIVED from the served id
	// (never hardcoded) and the same source as the provenance badge, so they can't drift.
	let modelLabel = $derived(resolveModelIdentity(currentModel.id).short);

	// Export the current conversation as a Markdown file. Fully client-side (nothing leaves
	// the browser); title derived from the first user turn for a meaningful filename. The
	// serializer excludes the system prompt/persona — see exportConversation.ts.
	const exportChat = () => {
		const firstUser = messages.find((m) => m.from === "user")?.content?.trim();
		const title = firstUser ? firstUser.split(/\s+/).slice(0, 8).join(" ") : undefined;
		downloadConversationMarkdown({ title, model: modelLabel, messages });
	};

	// The live-stack map is HIDDEN BY DEFAULT on both desktop and mobile — the answer is
	// primary and the inline trace carries the receipt. It's revealed on demand via the
	// `stackOpen` store (the per-answer trace's "behind the scenes ↗" link, and the welcome
	// "see how it's built"), presented as one responsive overlay: a right drawer on desktop,
	// a bottom sheet on mobile. No desktop-split / mobile-tab fork.

	const publicConfig = usePublicConfig();

	// Feature announcement toast: home screen only, gone as soon as a chat starts.
	let featureAnnouncement = $derived(
		getActiveAnnouncement(publicConfig.PUBLIC_FEATURE_ANNOUNCEMENTS)
	);
	let showFeatureAnnouncement = $derived(page.route.id === "/" && !messages.length && !loading);

	// Artifacts: fold <artifact> operations from the visible message path into a
	// versioned registry, shared with the inline cards and the side panel.
	// Only the message currently receiving tokens can have a streaming artifact;
	// unclosed tags anywhere else are interrupted generations, not live ones.
	let artifactRegistry = $derived(
		collectArtifacts(messages, loading ? messages.at(-1)?.id : undefined)
	);
	setArtifactsContext({
		get registry() {
			return artifactRegistry;
		},
		panel: artifactPanel,
	});

	// Auto-open the panel when a new artifact version starts streaming in
	// (once per version, so closing it mid-stream sticks).
	$effect(() => {
		const streaming = artifactRegistry.streaming;
		if (!streaming || !loading) return;
		artifactPanel.maybeAutoOpen(streaming.identifier, streaming.version);
	});

	let editMsdgId: Message["id"] | null = $state(null);
	let pastedLongContent = $state(false);

	// Voice recording state
	let isRecording = $state(false);
	let isTranscribing = $state(false);
	let isTouchDevice = $derived(browser && navigator.maxTouchPoints > 0);

	// Open-web search (P0 differentiator). Per Julie (2026-06-18) this is no longer
	// a manual composer toggle: the system decides when a turn needs current open-web
	// grounding. The decision AND the search now run on the SEND path, AFTER the user's
	// message is on screen (conversation/[id] writeMessage → resolveSearchContext in
	// $lib/search/resolveSearch) — so the message renders instantly instead of waiting
	// on the classify+search round-trip, which previously left a multi-second gap where
	// nothing appeared. The manual globe toggle is hidden (showWebSearch={false} below);
	// webSearchEnabled is retained dormant so the control can be re-exposed without rewiring.
	let webSearchEnabled = $state(false);
	let draftLooksRecent = $derived(isRecencyQueryDenoised(draft));

	// Serving provenance — so map flashes can gate the sovereign-compute node honestly
	// (never flash CSCS while HF-served), the same gate reveal.ts applies per answer.
	const serving = $derived(page.data.servingProvenance ?? resolveServing());

	const handleSubmit = async () => {
		// Guard on the trimmed draft, not just `!draft`: a whitespace-only draft ("   \n") is
		// truthy, so a bare `!draft` let the send button submit blank turns (Enter already trims).
		if (requireAuthUser() || loading || !draft.trim()) return;
		tap();
		const text = draft;
		draft = "";
		// Hand off immediately: the parent renders the user's message + a pending answer at
		// once, then resolves open-web grounding with a calm status ON that answer (no
		// composer-blocking spinner, no dead gap before anything shows). Grounding is resolved
		// parent-side because it must survive the home→/conversation/[id] navigation, whose
		// history state is JSON-only (a Promise can't cross it).
		onmessage?.(text);
	};

	let lastTarget: EventTarget | null = null;

	let onDrag = $state(false);

	const onDragEnter = (e: DragEvent) => {
		lastTarget = e.target;
		onDrag = true;
	};
	const onDragLeave = (e: DragEvent) => {
		if (e.target === lastTarget) {
			onDrag = false;
		}
	};

	const onPaste = (e: ClipboardEvent) => {
		const textContent = e.clipboardData?.getData("text");

		if (!$settings.directPaste && textContent && textContent.length >= 3984) {
			e.preventDefault();
			pastedLongContent = true;
			setTimeout(() => {
				pastedLongContent = false;
			}, 1000);
			const pastedFile = new File([textContent], "Pasted Content", {
				type: "application/vnd.chatui.clipboard",
			});

			files = [...files, pastedFile];
		}

		if (!e.clipboardData) {
			return;
		}

		// paste of files
		const pastedFiles = Array.from(e.clipboardData.files);
		if (pastedFiles.length !== 0) {
			e.preventDefault();

			// filter based on activeMimeTypes, including wildcards
			const filteredFiles = pastedFiles.filter((file) => {
				return activeMimeTypes.some((mimeType: string) => {
					const [type, subtype] = mimeType.split("/");
					const [fileType, fileSubtype] = file.type.split("/");
					return (
						(type === "*" || fileType === type) && (subtype === "*" || fileSubtype === subtype)
					);
				});
			});

			files = [...files, ...filteredFiles];
		}
	};

	let lastMessage = $derived(browser && (messages.at(-1) as Message));
	let showPendingPlaceholder = $derived(
		pending &&
			!(lastMessage && lastMessage.from === "assistant" && (lastMessage.content ?? "").length === 0)
	);
	let streamingAssistantMessage = $derived(
		(() => {
			for (let i = messages.length - 1; i >= 0; i -= 1) {
				const candidate = messages[i];
				if (candidate.from === "assistant") {
					return candidate;
				}
			}
			return undefined;
		})()
	);
	let lastIsError = $derived(
		!loading &&
			(streamingAssistantMessage?.updates?.findIndex(
				(u) => u.type === "status" && u.status === "error"
			) ?? -1) !== -1
	);

	let sources = $derived(
		files?.map<Promise<MessageFile>>((file) =>
			file2base64(file).then((value) => ({
				type: "base64",
				value,
				mime: file.type,
				name: file.name,
			}))
		)
	);

	let chatContainer: HTMLElement | undefined = $state();

	// Force scroll to bottom when user sends a new message or switches conversation
	let prevMessageCount = $state(0);
	// svelte-ignore state_referenced_locally
	let prevFirstMessageId = $state(messages.at(0)?.id);
	let forceReattach = $state(0);
	let scrollBehavior: "auto" | "instant" | "smooth" = $state("instant");
	$effect(() => {
		const firstMessageId = messages.at(0)?.id;

		// Conversation switch: first message ID changed
		if (firstMessageId !== prevFirstMessageId) {
			prevFirstMessageId = firstMessageId;
			scrollBehavior = "instant";
			forceReattach++;
			spacerActive = 0;
			spacerHeight = MIN_SPACER_PX;
			prevMessageCount = messages.length;
			artifactPanel.reset();
			return;
		}

		// New user message: user message + empty assistant message added together
		if (messages.length > prevMessageCount) {
			const last = messages.at(-1);
			const secondLast = messages.at(-2);
			const userJustSentMessage =
				messages.length === prevMessageCount + 2 &&
				secondLast?.from === "user" &&
				last?.from === "assistant" &&
				last?.content === "";

			if (userJustSentMessage) {
				scrollBehavior = "smooth";
				forceReattach++;
				// Only activate dynamic spacer after the first exchange
				// (first user+assistant pair scrolls normally)
				spacerActive = prevMessageCount >= 2 ? spacerActive + 1 : 0;
			}
		}
		prevMessageCount = messages.length;
	});

	// Shared conversations containing artifacts usually exist to show one off:
	// open the most recent artifact on load. Desktop only, since on mobile the
	// panel is a fullscreen overlay that would hide the conversation entirely.
	// Declared after the conversation-switch effect so its reset() can never
	// close the panel after this opens it within the same flush.
	let autoOpenedSharedArtifact = false;
	$effect(() => {
		if (autoOpenedSharedArtifact || !shared) return;
		const latest = [...artifactRegistry.artifacts.values()].at(-1);
		if (!latest) return;
		autoOpenedSharedArtifact = true;
		if (!window.matchMedia("(min-width: 768px)").matches) return;
		artifactPanel.openArtifact(latest.identifier, null);
	});

	// Combined scroll dependency for the action
	let scrollDependency = $derived({ forceReattach, scrollBehavior });

	// Dynamic bottom spacer for ChatGPT-style scroll (new message appears near top of viewport)
	const MIN_SPACER_PX = 208; // equivalent to pb-52
	const SPACER_TOP_OFFSET_PX = 50; // breathing room above the user message
	let spacerEl: HTMLElement | undefined = $state();
	let messagesEl: HTMLElement | undefined = $state();
	let spacerHeight = $state(MIN_SPACER_PX);
	let spacerActive = $state(0); // 0 = inactive, >0 = active (counter to force effect re-run)

	function computeSpacerHeight(): number {
		if (!chatContainer || !spacerEl) return MIN_SPACER_PX;

		const userMsgs = chatContainer.querySelectorAll('[data-message-type="user"]');
		const lastUserMsg = userMsgs[userMsgs.length - 1] as HTMLElement | undefined;
		if (!lastUserMsg) return MIN_SPACER_PX;

		const viewportHeight = chatContainer.clientHeight;
		const containerRect = chatContainer.getBoundingClientRect();
		const scrollTop = chatContainer.scrollTop;

		// Use the spacer element's own position as reference — this naturally accounts
		// for all flex gaps, padding, and layout between the user message and the spacer.
		const userMsgScrollTop =
			lastUserMsg.getBoundingClientRect().top - containerRect.top + scrollTop;
		const spacerScrollTop = spacerEl.getBoundingClientRect().top - containerRect.top + scrollTop;

		const contentHeight = spacerScrollTop - userMsgScrollTop;
		return Math.max(MIN_SPACER_PX, viewportHeight - contentHeight - SPACER_TOP_OFFSET_PX);
	}

	$effect(() => {
		// Don't gate on `loading` — the spacer must be computed immediately when
		// spacerActive is set (same tick as forceReattach++) so that the spacer
		// height is correct BEFORE snapScrollToBottom's scrollToBottom() fires.
		if (!spacerActive || !chatContainer || !messagesEl) return;

		const container = chatContainer;

		// Observe the messages wrapper (has h-max, resizes with content)
		// instead of the mx-auto container (has h-full, may not resize).
		const observer = new ResizeObserver(() => {
			spacerHeight = computeSpacerHeight();
			// The mx-auto container has h-full so its ResizeObserver in
			// snapScrollToBottom may not fire during streaming. Scroll here
			// to keep up with growing content, but only if user is near bottom.
			tick().then(() => {
				const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
				// Use a tight threshold (matching snapScrollToBottom's BOTTOM_THRESHOLD)
				// to avoid overriding user scroll intent during streaming.
				if (dist < 50) {
					container.scrollTo({ top: container.scrollHeight });
				}
			});
		});
		observer.observe(messagesEl);
		spacerHeight = computeSpacerHeight();

		return () => observer.disconnect();
	});

	const settings = useSettingsStore();
	let hideRouterExamples = $derived($settings.hidePromptExamples?.[currentModel.id] ?? false);

	// First-run orientation overlay. Mirrors prod's ChatShell: shown once per
	// browser on a FRESH chat (no messages), gated here in the chat panel so the
	// live-stack map stays visible beside it on desktop. Persistence is the
	// existing `welcomeModalSeen` setting; returning visitors / loaded histories
	// don't see it. Shared conversation views never show it.
	let chatInputRef = $state<ReturnType<typeof ChatInput>>();
	let showWelcome = $derived(!$settings.welcomeModalSeen && !shared && messages.length === 0);

	function dismissWelcome() {
		if (requireAuthUser()) return;
		void settings.instantSet({ welcomeModalSeen: true });
	}

	function handleWelcomeStart() {
		dismissWelcome();
		// Focus after the overlay unmounts so the composer is interactable.
		setTimeout(() => chatInputRef?.focusComposer(), 0);
	}

	function handleWelcomeSeeBuilt() {
		dismissWelcome();
		// Reveal the map overlay (same on both platforms now), then light the model node —
		// plus the sovereign-compute node ONLY if we genuinely serve on it (the welcome beat
		// must not claim CSCS while HF-served; same gate as reveal.ts). Deferred past the
		// dismiss re-render so it lands on the mounted, now-open map.
		stackOpen.set(true);
		if (browser) {
			setTimeout(() => {
				const ids = [...MODEL_NODES, ...(serving.isSovereign ? [COMPUTE_NODE] : [])];
				window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids } }));
			}, 0);
		}
	}

	// Respect per‑model multimodal toggle from settings (force enable)
	let modelIsMultimodalOverride = $derived($settings.multimodalOverrides?.[currentModel.id]);
	let modelIsMultimodal = $derived((modelIsMultimodalOverride ?? currentModel.multimodal) === true);

	// Always allow common text-like files; add images only when model is multimodal
	import { TEXT_MIME_ALLOWLIST, IMAGE_MIME_ALLOWLIST_DEFAULT } from "$lib/constants/mime";

	let activeMimeTypes = $derived(
		Array.from(
			new Set([
				...TEXT_MIME_ALLOWLIST,
				...(modelIsMultimodal
					? (currentModel.multimodalAcceptedMimetypes ?? [...IMAGE_MIME_ALLOWLIST_DEFAULT])
					: []),
			])
		)
	);
	let isFileUploadEnabled = $derived(activeMimeTypes.length > 0);
	let focused = $state(false);

	let activeRouterExamplePrompt = $state<string | null>(null);
	let activeExamples = $derived<RouterExample[]>(routerExamples);
	let routerFollowUps = $derived<RouterFollowUp[]>(
		activeRouterExamplePrompt
			? (activeExamples.find((ex) => ex.prompt === activeRouterExamplePrompt)?.followUps ?? [])
			: []
	);
	let routerUserMessages = $derived(messages.filter((msg) => msg.from === "user"));
	let shouldShowRouterFollowUps = $derived(
		!draft.length &&
			activeRouterExamplePrompt &&
			routerFollowUps.length > 0 &&
			routerUserMessages.length === 1 &&
			currentModel.isRouter &&
			!hideRouterExamples &&
			!loading
	);

	$effect(() => {
		if (!currentModel.isRouter || !messages.length) {
			activeRouterExamplePrompt = null;
			return;
		}

		const firstUserMessage = messages.find((msg) => msg.from === "user");
		if (!firstUserMessage) {
			activeRouterExamplePrompt = null;
			return;
		}

		const match = activeExamples.find((ex) => ex.prompt.trim() === firstUserMessage.content.trim());
		activeRouterExamplePrompt = match ? match.prompt : null;
	});

	$effect(() => {
		if ($pendingChatInput) {
			draft = $pendingChatInput;
			pendingChatInput.set(undefined);
		}
	});

	function triggerPrompt(prompt: string) {
		if (requireAuthUser() || loading) return;
		draft = prompt;
		handleSubmit();
	}

	async function startExample(example: RouterExample) {
		if (requireAuthUser()) return;
		activeRouterExamplePrompt = example.prompt;

		if (browser && example.attachments?.length) {
			const loadedFiles: File[] = [];
			for (const attachment of example.attachments) {
				try {
					const response = await fetch(`${base}/${attachment.src}`);
					if (!response.ok) continue;

					const blob = await response.blob();
					const name = attachment.src.split("/").pop() ?? "attachment";
					loadedFiles.push(
						new File([blob], name, { type: blob.type || "application/octet-stream" })
					);
				} catch (err) {
					console.error("Error loading attachment:", err);
				}
			}
			files = loadedFiles;
		}

		triggerPrompt(example.prompt);
	}

	function startFollowUp(followUp: RouterFollowUp) {
		triggerPrompt(followUp.prompt);
	}

	async function handleRecordingConfirm(audioBlob: Blob) {
		isRecording = false;
		isTranscribing = true;

		try {
			const response = await fetch(`${base}/api/transcribe`, {
				method: "POST",
				headers: { "Content-Type": audioBlob.type },
				body: audioBlob,
			});

			if (!response.ok) {
				throw new Error(await response.text());
			}

			const { text } = await response.json();
			const trimmedText = text?.trim();
			if (trimmedText) {
				// Append transcribed text to draft
				draft = draft.trim() ? `${draft.trim()} ${trimmedText}` : trimmedText;
			}
		} catch (err) {
			console.error("Transcription error:", err);
			$error = "Transcription failed. Please try again.";
		} finally {
			isTranscribing = false;
		}
	}

	async function handleRecordingSend(audioBlob: Blob) {
		isRecording = false;
		isTranscribing = true;

		try {
			const response = await fetch(`${base}/api/transcribe`, {
				method: "POST",
				headers: { "Content-Type": audioBlob.type },
				body: audioBlob,
			});

			if (!response.ok) {
				throw new Error(await response.text());
			}

			const { text } = await response.json();
			const trimmedText = text?.trim();
			if (trimmedText) {
				// Set draft and send immediately
				draft = draft.trim() ? `${draft.trim()} ${trimmedText}` : trimmedText;
				handleSubmit();
			}
		} catch (err) {
			console.error("Transcription error:", err);
			$error = "Transcription failed. Please try again.";
		} finally {
			isTranscribing = false;
		}
	}

	function handleRecordingError(message: string) {
		console.error("Recording error:", message);
		isRecording = false;
		$error = message;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === "Escape" && $stackOpen) stackOpen.set(false);
	}}
	ondragenter={onDragEnter}
	ondragleave={onDragLeave}
	ondragover={(e) => {
		e.preventDefault();
	}}
	ondrop={(e) => {
		e.preventDefault();
		onDrag = false;
	}}
/>

<!-- pointer-events-none: the chat column sits at z-[-1]; this wrapper's
     hit-area would otherwise swallow every click meant for it. Children
     re-enable pointer events themselves. -->
<div class="pointer-events-none relative flex h-full min-h-0 min-w-0 flex-col md:flex-row">
	<!-- Single, top-level contribute dialog (store-driven). Mounted here — not nested
	     inside the welcome overlay — so its Modal backdrop intro plays correctly. -->
	<ContributeDialog />
	<!-- Honest "blind spots" disclosure, opened from the composer footer link. -->
	<BlindSpotsModal />
	<div
		role="main"
		aria-label="Chat"
		class="pointer-events-auto relative z-[-1] min-h-0 min-w-0 flex-1"
	>
		<!-- One per-page H1 for the screen-reader/document outline (the visible greeting is
		     decorative display text); visually hidden so the editorial layout is unchanged. -->
		<h1 class="sr-only">AI Potluck — open-source, sovereign AI chat</h1>

		<!-- Persistent map toggle — mirrors the left sidebar's collapse/expand control: subtle,
		     always available on both platforms. Opens the live-stack map (desktop: a side column
		     that pushes the chat; mobile: a bottom sheet). The per-answer trace's "behind the
		     scenes ↗" link still opens the same map (stackOpen), so there are two ways in. -->
		<button
			type="button"
			onclick={() => stackOpen.update((v) => !v)}
			aria-expanded={$stackOpen}
			aria-label={$stackOpen ? "Hide the stack map" : "Show what's behind the answer"}
			title={$stackOpen ? "Hide what's behind the answer" : "Behind the scenes — the live stack"}
			class="pointer-events-auto absolute top-3 right-3 z-30 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] backdrop-blur transition-colors
				{$stackOpen
				? 'border-[var(--ap-live)]/45 bg-[var(--ap-live)]/10 text-[var(--ap-ink-2)]'
				: 'border-[var(--ap-rule)] bg-[var(--ap-paper)]/70 text-[var(--ap-ink-3)] hover:border-[var(--ap-ink-3)]/40 hover:text-[var(--ap-ink)]'}"
		>
			<IconPanelRight class="size-3.5 shrink-0" />
			<span class="hidden sm:inline">behind the scenes</span>
		</button>
		{#if showWelcome}
			<WelcomeModal
				modelId={currentModel.id}
				onStartChatting={handleWelcomeStart}
				onSeeHowBuilt={handleWelcomeSeeBuilt}
				onSkip={dismissWelcome}
			/>
		{/if}
		{#if featureAnnouncement && showFeatureAnnouncement}
			<FeatureAnnouncementToast announcement={featureAnnouncement} />
		{/if}
		<ConnectionStatus />
		<div
			class="scrollbar-custom h-full overflow-y-auto"
			use:snapScrollToBottom={scrollDependency}
			bind:this={chatContainer}
		>
			<!-- @container: descendants (e.g. the per-message router-metadata row) adapt
			     to the actual column width, which shrinks when the artifact panel is open -->
			<div
				class="@container mx-auto flex h-full max-w-3xl flex-col gap-6 px-5 pt-6 sm:gap-8 xl:max-w-4xl xl:pt-10"
			>
				{#if preprompt && preprompt != currentModel.preprompt}
					<SystemPromptModal preprompt={preprompt ?? ""} />
				{/if}

				{#if messages.length > 0}
					<div bind:this={messagesEl} class="flex h-max flex-col gap-8">
						{#each messages as message, idx (message.id)}
							<ChatMessage
								{loading}
								{message}
								modelId={currentModel.id}
								gap={message.from === "assistant"
									? gapForPrompt(messages[idx - 1]?.content)
									: undefined}
								question={message.from === "assistant" ? messages[idx - 1]?.content : undefined}
								alternatives={messagesAlternatives.find((a) => a.includes(message.id)) ?? []}
								isAuthor={!shared}
								readOnly={isReadOnly}
								isLast={idx === messages.length - 1}
								bind:editMsdgId
								onretry={(payload) => onretry?.(payload)}
								onshowAlternateMsg={(payload) => onshowAlternateMsg?.(payload)}
							/>
						{/each}
						{#if showPendingPlaceholder}
							<ChatMessage
								loading={true}
								message={{
									id: "pending-placeholder",
									content: "",
									from: "assistant",
									children: [],
								}}
								isAuthor={!shared}
								readOnly={isReadOnly}
							/>
						{/if}
						{#if isReadOnly}
							<ModelSwitch {models} {currentModel} />
						{/if}
					</div>
					<!-- Dynamic bottom spacer: large when streaming new message, shrinks as response grows -->
					<div bind:this={spacerEl} class="flex-shrink-0" style="height: {spacerHeight}px;"></div>
				{:else if pending}
					<ChatMessage
						loading={true}
						message={{
							id: "0-0-0-0-0",
							content: "",
							from: "assistant",
							children: [],
						}}
						isAuthor={!shared}
						readOnly={isReadOnly}
					/>
				{:else}
					<ChatIntroduction {currentModel} onmessage={(content) => onmessage?.(content)} />
				{/if}
			</div>

			<ScrollToPreviousBtn class="fixed right-4 bottom-48 lg:right-10" scrollNode={chatContainer} />

			<ScrollToBottomBtn class="fixed right-4 bottom-36 lg:right-10" scrollNode={chatContainer} />
		</div>

		<div
			class="xl:max-w-4xl/0 pointer-events-none absolute inset-x-0 bottom-0 z-0 mx-auto flex
			w-full max-w-3xl flex-col items-center justify-center bg-linear-to-t
			from-[var(--ap-paper)] via-[var(--ap-paper)] to-[var(--ap-paper)]/0 px-3.5 pt-2
			*:pointer-events-auto max-sm:py-0
			sm:px-5 md:pb-4"
		>
			{#if !draft.length && !messages.length && !sources.length && !loading && currentModel.isRouter && activeExamples.length && !hideRouterExamples && !lastIsError}
				<div
					class="mb-3 no-scrollbar flex w-full justify-start gap-2 overflow-x-auto whitespace-nowrap text-[var(--ap-ink-3)] select-none"
				>
					{#each activeExamples as ex}
						<button
							class="flex items-center gap-1 rounded-lg bg-[var(--ap-paper)]/90 px-2 py-0.5 text-center text-sm backdrop-blur-sm hover:text-[var(--ap-ink-2)]/50"
							onclick={() => startExample(ex)}
						>
							{ex.title}
							{#if ex.artifact}
								<LucideSparkles class="size-3 flex-none text-blue-600 dark:text-blue-400" />
							{/if}
						</button>
					{/each}
				</div>
			{/if}
			{#if shouldShowRouterFollowUps && !lastIsError}
				<div
					class="mb-3 no-scrollbar flex w-full justify-start gap-2 overflow-x-auto whitespace-nowrap text-[var(--ap-ink-3)] select-none"
				>
					<!-- <span class=" text-[var(--ap-ink-3)]">Follow ups</span> -->
					{#each routerFollowUps as followUp}
						<button
							class="flex items-center gap-1 rounded-lg bg-[var(--ap-paper)]/90 px-2 py-0.5 text-center text-sm backdrop-blur-sm hover:text-[var(--ap-ink-2)]/50"
							onclick={() => startFollowUp(followUp)}
						>
							<CarbonDirectionRight class="scale-y-[-1] text-xs" />
							{followUp.title}</button
						>
					{/each}
				</div>
			{/if}
			{#if sources?.length && !loading}
				<div
					in:fly|local={sources.length === 1 ? { y: -20, easing: cubicInOut } : undefined}
					class="flex flex-row flex-wrap justify-center gap-2.5 rounded-xl pb-3"
				>
					{#each sources as source, index}
						{#await source then src}
							<UploadedFile
								file={src}
								onclose={() => {
									files = files.filter((_, i) => i !== index);
								}}
							/>
						{/await}
					{/each}
				</div>
			{/if}

			<div class="w-full">
				<div class="flex w-full *:mb-3">
					{#if !loading && lastIsError}
						<RetryBtn
							classNames="ml-auto"
							onClick={() => {
								if (lastMessage && lastMessage.ancestors) {
									onretry?.({
										id: lastMessage.id,
									});
								}
							}}
						/>
					{/if}
				</div>
				<form
					tabindex="-1"
					aria-label={isFileUploadEnabled ? "file dropzone" : undefined}
					onsubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
					class={{
						"relative flex w-full max-w-4xl flex-1 items-center rounded-xl border bg-[var(--ap-paper)]": true,
						"opacity-30": isReadOnly,
						"max-sm:mb-4": focused && isVirtualKeyboard(),
					}}
				>
					{#if isRecording || isTranscribing}
						<VoiceRecorder
							{isTranscribing}
							{isTouchDevice}
							oncancel={() => {
								isRecording = false;
							}}
							onconfirm={handleRecordingConfirm}
							onsend={handleRecordingSend}
							onerror={handleRecordingError}
						/>
					{:else if onDrag && isFileUploadEnabled}
						<FileDropzone bind:files bind:onDrag mimeTypes={activeMimeTypes} />
					{:else}
						<div
							class="flex w-full flex-1 rounded-xl border-none bg-transparent"
							class:paste-glow={pastedLongContent}
						>
							{#if lastIsError}
								<ChatInput value="Sorry, something went wrong. Please try again." disabled={true} />
							{:else}
								<ChatInput
									bind:this={chatInputRef}
									placeholder={isReadOnly ? "This conversation is read-only." : "Ask anything..."}
									{loading}
									bind:value={draft}
									bind:files
									mimeTypes={activeMimeTypes}
									onsubmit={handleSubmit}
									{onPaste}
									disabled={isReadOnly || lastIsError}
									{modelIsMultimodal}
									showWebSearch={false}
									{modelLabel}
									bind:webSearchEnabled
									webSearchAffordance={draftLooksRecent && !webSearchEnabled}
									bind:focused
								/>
							{/if}

							{#if loading}
								<StopGeneratingBtn
									onClick={() => {
										hapticError();
										onstop?.();
									}}
									showBorder={true}
									classNames="absolute bottom-2 right-2 size-8 sm:size-7 self-end rounded-xl border bg-white text-black shadow-sm transition-none dark:border-transparent dark:text-white"
								/>
							{:else}
								<!-- Voice/mic removed for the alpha: voice is a WANTED / "open invitation" node on the
							     stack map (not built); a working mic would contradict our own honest gap map. -->
								<button
									class="absolute right-2 bottom-2 btn size-8 self-end rounded-xl border bg-white text-black shadow transition-none enabled:hover:bg-white enabled:hover:shadow-inner sm:size-7 dark:border-transparent dark:text-white dark:hover:enabled:bg-black {!draft.trim() ||
									isReadOnly
										? ''
										: 'bg-black! text-white! dark:bg-white! dark:text-black!'}"
									disabled={!draft.trim() || isReadOnly}
									type="submit"
									aria-label="Send message"
									name="submit"
								>
									<IconArrowUp />
								</button>
							{/if}
						</div>
					{/if}
				</form>

				<!-- Honest, no-number data-handling line near the composer. The precise
				     retention window lives on the /privacy page; this line stays qualitative. -->
				<div class="mt-1 text-center font-mono text-[9px] text-[var(--ap-ink-3)] opacity-70">
					<span>No account needed · guest chats are auto-deleted</span>
					<div class="mt-0.5">
						<a
							class="inline-block py-1.5 underline-offset-2 hover:text-[var(--ap-ink)] hover:underline"
							href="{base}/terms"
						>
							Terms &amp; Safety
						</a>
						<span class="mx-1.5 opacity-50">·</span>
						<a
							class="inline-block py-1.5 underline-offset-2 hover:text-[var(--ap-ink)] hover:underline"
							href="{base}/privacy"
						>
							Privacy
						</a>
						<span class="mx-1.5 opacity-50">·</span>
						<!-- Honest-limitations disclosure (recency, language skew, not-advice, can-be-wrong).
						     A button, not a route — opens the BlindSpotsModal mounted above. -->
						<button
							type="button"
							class="inline-block cursor-pointer py-1.5 underline-offset-2 hover:text-[var(--ap-ink)] hover:underline"
							onclick={() => blindSpotsOpen.set(true)}
						>
							Blind spots
						</button>
						{#if messages.length}
							<span class="mx-1.5 opacity-50">·</span>
							<button
								type="button"
								class="inline-block cursor-pointer py-1.5 underline-offset-2 hover:text-[var(--ap-ink)] hover:underline"
								onclick={exportChat}
							>
								Export
							</button>
						{/if}
						<span class="mx-1.5 opacity-50">·</span>
						<ShareButton class="py-1.5 align-baseline" />
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- "Behind the scenes" live-stack map — hidden by default on both platforms, revealed
	     on demand from the per-answer trace's "behind the scenes ↗" link (stackOpen store).
	     ONE responsive overlay: a right-side drawer on desktop, a bottom sheet on mobile.
	     The map stays MOUNTED while closed (the panel just slides off-screen) so its
	     ap:flash / ap:pulse-* listeners stay live — a reveal-and-flash lands on a map that's
	     already listening, and a turn that streams while it's closed still pulses underneath. -->
	{#if $stackOpen}
		<!-- Scrim: MOBILE only — the bottom sheet overlays the chat, so dim + tap-to-close.
		     On desktop the map is a side column that sits BESIDE the chat (both visible), so no
		     scrim there: dimming the chat you're reading alongside the map would defeat the point. -->
		<button
			type="button"
			aria-label="Close behind the scenes"
			transition:fade={{ duration: 200 }}
			class="pointer-events-auto fixed inset-0 z-40 bg-[var(--ap-ink)]/25 md:hidden"
			onclick={() => stackOpen.set(false)}
		></button>
	{/if}
	<!-- Live-stack map. MOBILE: a fixed bottom sheet that slides up over the chat. DESKTOP: an
	     in-flow flex column (sibling of the chat in the md:flex-row root) whose width animates
	     0 ↔ ~560px, so opening it PUSHES the chat rather than covering it — both stay visible,
	     mirroring the left sidebar. Stays MOUNTED while closed (mobile: slid off; desktop: w-0,
	     overflow-clipped) so its ap:flash / ap:pulse-* listeners survive a close. -->
	<div
		class="fixed inset-x-0 top-14 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl border-t border-[var(--ap-rule)]
			bg-[var(--ap-paper)] shadow-2xl transition-[transform,width] duration-300 ease-out
			md:relative md:inset-auto md:top-auto md:bottom-auto md:z-auto md:h-full md:shrink-0 md:translate-y-0
			md:rounded-none md:border-t-0 md:border-l md:shadow-none
			{$stackOpen
			? 'pointer-events-auto translate-y-0 md:w-[min(40%,560px)] md:translate-x-0'
			: 'pointer-events-none translate-y-full md:w-0 md:translate-x-0 md:translate-y-0'}"
		role="dialog"
		aria-label="Behind the scenes — the live open-source stack"
		aria-hidden={!$stackOpen}
	>
		<!-- Close affordance: a grab-bar reads as "drag/tap to dismiss" on mobile; the × is the
		     explicit control on desktop. Both sit above the map's own "Under the hood" header. -->
		<button
			type="button"
			aria-label="Close"
			class="absolute top-2.5 right-2.5 z-10 flex size-7 items-center justify-center rounded-full text-[var(--ap-ink-3)] transition-colors hover:bg-[var(--ap-rule)]/50 hover:text-[var(--ap-ink)]"
			onclick={() => stackOpen.set(false)}
		>
			<CarbonClose class="text-[0.9rem]" />
		</button>
		<button
			type="button"
			aria-label="Close"
			class="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[var(--ap-ink-3)]/30 md:hidden"
			onclick={() => stackOpen.set(false)}
		></button>
		<StackMap active={loading} {messages} />
	</div>

	<ArtifactPanel registry={artifactRegistry} {loading} />
</div>

<style>
	.paste-glow {
		animation: glow 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
		will-change: box-shadow;
	}

	@keyframes glow {
		0% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.8);
		}
		50% {
			box-shadow: 0 0 20px 4px rgba(59, 130, 246, 0.6);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
		}
	}
</style>
