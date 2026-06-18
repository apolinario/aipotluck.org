<script lang="ts">
	import type { Message, MessageFile } from "$lib/types/Message";
	import type { SearchContext } from "$lib/types/Search";
	import { isRecencyQuery } from "$lib/search/recency";
	import { onDestroy, onMount, tick } from "svelte";

	import ArtifactPanel from "./ArtifactPanel.svelte";
	import StackMap from "$lib/components/stack/StackMap.svelte";
	import { collectArtifacts } from "$lib/utils/artifacts";
	import { setArtifactsContext } from "$lib/utils/artifactsContext";
	import { artifactPanel } from "$lib/stores/artifactPanel.svelte";

	import CarbonDirectionRight from "~icons/carbon/direction-right-01";
	import IconArrowUp from "~icons/lucide/arrow-up";

	import ChatInput from "./ChatInput.svelte";
	import WelcomeModal from "$lib/components/WelcomeModal.svelte";
	import ContributeDialog from "./ContributeDialog.svelte";
	import VoiceRecorder from "./VoiceRecorder.svelte";
	import StopGeneratingBtn from "../StopGeneratingBtn.svelte";
	import type { Model } from "$lib/types/Model";
	import FileDropzone from "./FileDropzone.svelte";
	import RetryBtn from "../RetryBtn.svelte";
	import file2base64 from "$lib/utils/file2base64";
	import { base } from "$app/paths";
	import { resolveModelIdentity } from "$lib/identity";
	import ChatMessage from "./ChatMessage.svelte";
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
	import FeatureAnnouncementToast from "../FeatureAnnouncementToast.svelte";
	import { getActiveAnnouncement } from "$lib/utils/featureAnnouncements";
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";
	import { pendingChatInput } from "$lib/stores/pendingChatInput";
	import LucideSparkles from "~icons/lucide/sparkles";

	import { fly } from "svelte/transition";
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

	// Mobile only (below md): the split-screen collapses to a single column with a
	// Chat / "Under the hood" tab switcher — on a phone the map is one tap away
	// rather than hidden. Most users arrive here from a QR code on a phone, so this
	// is the primary surface, not an afterthought. The dot flags unseen map
	// activity (a turn streamed, or a "show on map" flash fired) while on the chat
	// tab. Desktop ignores all of this: both panels render side by side, nav hidden.
	let mobileTab = $state<"chat" | "map">("chat");
	let mapHasActivity = $state(false);

	$effect(() => {
		if (loading && mobileTab === "chat") mapHasActivity = true;
	});

	onMount(() => {
		const onFlash = () => {
			if (mobileTab === "chat") mapHasActivity = true;
		};
		window.addEventListener("ap:flash", onFlash);
		return () => window.removeEventListener("ap:flash", onFlash);
	});

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
	let transcriptionEnabled = $derived(
		!!(page.data as { transcriptionEnabled?: boolean }).transcriptionEnabled
	);
	let isTouchDevice = $derived(browser && navigator.maxTouchPoints > 0);

	// Open-web search (P0 differentiator): an explicit composer toggle, never
	// model-driven tool-calling (Apertus's is unreliable). When on, the turn is
	// grounded on Wikipedia + Marginalia: we fetch /api/search here, flash the
	// Web-search node on the map, then hand the result to the send flow as
	// searchContext. A recency-looking draft surfaces the affordance (a hint on
	// the globe) but the user always decides — nothing auto-searches.
	let webSearchEnabled = $state(false);
	let webSearching = $state(false);
	let draftLooksRecent = $derived(isRecencyQuery(draft));

	async function runOpenSearch(query: string): Promise<SearchContext | undefined> {
		try {
			// Mirror the chat event on the live-stack map the instant search starts.
			window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: ["websearch"] } }));
			const res = await fetch(`${base}/api/search?q=${encodeURIComponent(query)}`);
			if (!res.ok) return undefined;
			const result = (await res.json()) as SearchContext;
			return result?.sources?.length ? result : undefined;
		} catch {
			// Search is best-effort: a failure degrades to an ungrounded answer
			// rather than blocking the turn.
			return undefined;
		}
	}

	const handleSubmit = async () => {
		if (requireAuthUser() || loading || !draft || webSearching) return;
		tap();
		const text = draft;
		draft = "";

		let searchContext: SearchContext | undefined;
		if (webSearchEnabled) {
			webSearching = true;
			try {
				searchContext = await runOpenSearch(text);
			} finally {
				webSearching = false;
			}
		}

		onmessage?.(text, { searchContext });
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
	let streamingRouterMetadata = $derived(streamingAssistantMessage?.routerMetadata ?? null);
	let streamingRouterModelName = $derived(
		streamingRouterMetadata?.model
			? (streamingRouterMetadata.model.split("/").pop() ?? streamingRouterMetadata.model)
			: ""
	);

	let lastIsError = $derived(
		!loading &&
			(streamingAssistantMessage?.updates?.findIndex(
				(u) => u.type === "status" && u.status === "error"
			) ?? -1) !== -1
	);

	let showRouterDetails = $state(false);
	let routerDetailsTimeout: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!currentModel.isRouter || !loading) {
			showRouterDetails = false;
			if (routerDetailsTimeout) {
				clearTimeout(routerDetailsTimeout);
				routerDetailsTimeout = undefined;
			}
			return;
		}

		if (routerDetailsTimeout) {
			clearTimeout(routerDetailsTimeout);
		}

		showRouterDetails = false;
		routerDetailsTimeout = setTimeout(() => {
			showRouterDetails = true;
		}, 500);
	});

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

	onDestroy(() => {
		if (routerDetailsTimeout) {
			clearTimeout(routerDetailsTimeout);
		}
	});

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
		if (browser && window.matchMedia("(max-width: 767px)").matches) {
			mobileTab = "map";
			mapHasActivity = false;
		} else if (browser) {
			// Defer past the dismiss re-render, or it would wipe the flash class.
			setTimeout(() => {
				window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: ["apertus", "cscs"] } }));
			}, 0);
		}
	}

	// Respect per‑model multimodal toggle from settings (force enable)
	let modelIsMultimodalOverride = $derived($settings.multimodalOverrides?.[currentModel.id]);
	let modelIsMultimodal = $derived((modelIsMultimodalOverride ?? currentModel.multimodal) === true);

	// Tools/MCP removed (B1-lite strip).
	let modelSupportsTools = $derived(false);

	// Get provider override for the current model (HuggingChat only)
	let providerOverride = $derived($settings.providerOverrides?.[currentModel.id]);
	let hasProviderOverride = $derived(
		providerOverride && providerOverride !== "auto" && !currentModel.isRouter
	);

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
	<div
		role="main"
		aria-label="Chat"
		class="pointer-events-auto relative z-[-1] min-h-0 min-w-0 flex-1"
		class:max-md:hidden={mobileTab === "map"}
	>
		<!-- One per-page H1 for the screen-reader/document outline (the visible greeting is
		     decorative display text); visually hidden so the editorial layout is unchanged. -->
		<h1 class="sr-only">AI Potluck — open-source, sovereign AI chat</h1>
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
					<ChatIntroduction
						{currentModel}
						onmessage={async (content) => {
							// Match prod (suggested-actions.tsx): a recency starter prompt (the
							// EU AI Act one) routes straight through open-web search on click —
							// one tap demos search + the map flash — while other starters just send.
							if (isRecencyQuery(content)) {
								const searchContext = await runOpenSearch(content);
								onmessage?.(content, { searchContext });
							} else {
								onmessage?.(content);
							}
						}}
					/>
				{/if}
			</div>

			<ScrollToPreviousBtn class="fixed right-4 bottom-48 lg:right-10" scrollNode={chatContainer} />

			<ScrollToBottomBtn class="fixed right-4 bottom-36 lg:right-10" scrollNode={chatContainer} />
		</div>

		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 z-0 mx-auto flex w-full
			max-w-3xl flex-col items-center justify-center bg-linear-to-t from-[var(--ap-paper)]
			via-[var(--ap-paper)] to-[var(--ap-paper)]/0 px-3.5 pt-2 *:pointer-events-auto
			max-sm:py-0 sm:px-5
			md:pb-4 xl:max-w-4xl dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900/0"
		>
			{#if !draft.length && !messages.length && !sources.length && !loading && currentModel.isRouter && activeExamples.length && !hideRouterExamples && !lastIsError}
				<div
					class="mb-3 no-scrollbar flex w-full justify-start gap-2 overflow-x-auto whitespace-nowrap text-gray-400 select-none dark:text-gray-500"
				>
					{#each activeExamples as ex}
						<button
							class="flex items-center gap-1 rounded-lg bg-gray-100/90 px-2 py-0.5 text-center text-sm backdrop-blur-sm hover:text-gray-500 dark:bg-gray-700/50 dark:hover:text-gray-400"
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
					class="mb-3 no-scrollbar flex w-full justify-start gap-2 overflow-x-auto whitespace-nowrap text-gray-400 select-none dark:text-gray-500"
				>
					<!-- <span class=" text-gray-500 dark:text-gray-400">Follow ups</span> -->
					{#each routerFollowUps as followUp}
						<button
							class="flex items-center gap-1 rounded-lg bg-gray-100/90 px-2 py-0.5 text-center text-sm backdrop-blur-sm hover:text-gray-500 dark:bg-gray-700/50 dark:hover:text-gray-400"
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
						"relative flex w-full max-w-4xl flex-1 items-center rounded-xl border bg-gray-100 dark:border-gray-700 dark:bg-gray-800": true,
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
									{modelSupportsTools}
									showWebSearch={!isReadOnly}
									{modelLabel}
									bind:webSearchEnabled
									{webSearching}
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
									classNames="absolute bottom-2 right-2 size-8 sm:size-7 self-end rounded-xl border bg-white text-black shadow-sm transition-none dark:border-transparent dark:bg-gray-600 dark:text-white"
								/>
							{:else}
								<!-- Voice/mic removed for the alpha: voice is a WANTED / "open invitation" node on the
							     stack map (not built); a working mic would contradict our own honest gap map. -->
								<button
									class="absolute right-2 bottom-2 btn size-8 self-end rounded-xl border bg-white text-black shadow transition-none enabled:hover:bg-white enabled:hover:shadow-inner sm:size-7 dark:border-transparent dark:bg-gray-600 dark:text-white dark:hover:enabled:bg-black {!draft ||
									isReadOnly
										? ''
										: 'bg-black! text-white! dark:bg-white! dark:text-black!'}"
									disabled={!draft || isReadOnly}
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
							class="underline-offset-2 hover:text-[var(--ap-ink)] hover:underline"
							href="{base}/terms"
						>
							Terms &amp; Safety
						</a>
						<span class="mx-1.5 opacity-50">·</span>
						<a
							class="underline-offset-2 hover:text-[var(--ap-ink)] hover:underline"
							href="{base}/privacy"
						>
							Privacy
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- "Under the hood" live-stack map — the split-screen right pane that mirrors
	     the chat (pulses the model node while streaming, persists provenance after).
	     Desktop: always visible. Mobile: full-width, shown when the map tab is active. -->
	<StackMap active={loading} {messages} mobileActive={mobileTab === "map"} />

	<!-- Mobile-only tab switcher. Lives in the column flow (root is flex-col below
	     md) so neither panel sits under it; hidden from md up where both show. -->
	<nav
		class="pointer-events-auto flex shrink-0 items-stretch border-t border-gray-200 bg-white md:hidden dark:border-gray-800 dark:bg-gray-900"
	>
		<button
			type="button"
			class="flex-1 py-2.5 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors {mobileTab ===
			'chat'
				? 'text-gray-900 dark:text-gray-100'
				: 'text-gray-400 dark:text-gray-500'}"
			onclick={() => (mobileTab = "chat")}
		>
			Chat
		</button>
		<button
			type="button"
			class="relative flex-1 py-2.5 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors {mobileTab ===
			'map'
				? 'text-gray-900 dark:text-gray-100'
				: 'text-gray-400 dark:text-gray-500'}"
			onclick={() => {
				mobileTab = "map";
				mapHasActivity = false;
			}}
		>
			Under the hood
			{#if mapHasActivity && mobileTab !== "map"}
				<span
					aria-hidden="true"
					class="absolute top-2 ml-1.5 size-1.5 rounded-full"
					style="background:var(--ap-live);"
				></span>
			{/if}
		</button>
	</nav>

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
