<script lang="ts">
	import ChatWindow from "$lib/components/chat/ChatWindow.svelte";
	import { consumePendingFiles } from "$lib/utils/pendingFiles";
	import { isAborted } from "$lib/stores/isAborted";
	import { onMount, untrack } from "svelte";
	import { page } from "$app/state";
	import { beforeNavigate, replaceState } from "$app/navigation";
	import { UrlDependency } from "$lib/types/UrlDependency";
	import { safeInvalidate } from "$lib/utils/safeInvalidate";
	import { base } from "$app/paths";
	import { ERROR_MESSAGES, error } from "$lib/stores/errors";
	import { findCurrentModel } from "$lib/utils/models";
	import type { Message } from "$lib/types/Message";
	import type { SearchContext } from "$lib/types/Search";
	import { searchProvenance, moderationMarker } from "$lib/messageProvenance";
	import { MessageUpdateStatus, MessageUpdateType } from "$lib/types/MessageUpdate";
	import { useConversationsStore } from "$lib/stores/conversations.svelte";
	import file2base64 from "$lib/utils/file2base64";
	import { addChildren } from "$lib/utils/tree/addChildren";
	import { addSibling } from "$lib/utils/tree/addSibling";
	import {
		fetchMessageUpdates,
		resolveStreamingMode,
		GenerationConflictError,
	} from "$lib/utils/messageUpdates";
	import { getCachedAnswer } from "$lib/utils/starterCache";
	import { v4 } from "uuid";
	import { useSettingsStore } from "$lib/stores/settings.js";
	import { browser } from "$app/environment";
	import {
		addBackgroundGeneration,
		removeBackgroundGeneration,
	} from "$lib/stores/backgroundGenerations";
	import type { TreeNode, TreeId } from "$lib/utils/tree/tree";
	import "katex/dist/katex.min.css";
	import { updateDebouncer } from "$lib/utils/updates.js";
	import { loading } from "$lib/stores/loading.js";
	import { streamStart } from "$lib/utils/haptics";
	import { requireAuthUser } from "$lib/utils/auth.js";
	import { isConversationGenerationActive, isGenerationStale } from "$lib/utils/generationState";
	import { useAPIClient, handleResponse } from "$lib/APIClient";

	let { data } = $props();

	// Obtain the conversations store during component init (context must be read
	// synchronously, not inside async callbacks or event handlers).
	const convsStore = useConversationsStore();

	let convId = $derived(page.params.id ?? "");
	let pending = $state(false);
	let initialRun = true;
	// Conversation-scoped stop tombstone. A boolean reset on page.params.id
	// changes resurrects the generating UI: invalidation reassigns page.params,
	// which clears the flag while the stopped conversation's snapshot is still
	// non-terminal, flipping $loading back on. Keying the tombstone by
	// conversation id makes it survive invalidations; it expires when a new
	// generation starts in this conversation.
	let stopRequestedFor: string | null = $state(null);
	let stopRequestPromise: Promise<void> | undefined;
	// Id of the generation run this tab started, sent with the generation
	// request and echoed in the stop request so the server can clamp the
	// persisted text to the stop point of the run it belongs to.
	let activeGenerationId: string | undefined;
	// True while writeMessage runs; lets the generation-state effect skip the
	// snapshot-staleness check for the generation streaming in this very tab.
	let writeMessageInFlight = false;
	let messageUpdatesAbortController = new AbortController();
	// Set to the conversation id when writeMessage painted a pre-vetted cached
	// answer client-side for a turn the server never recorded (the request dropped
	// before egress or before any token). While set for the open conversation:
	//   - the generation-state effect must treat the turn as FINISHED, not active.
	//     The cache-painted assistant carries no terminal update, so without this
	//     it reads as "still generating" — which both re-arms the spinner forever
	//     AND registers a background generation whose poller then fires an
	//     isTerminal reconcile (the server has no such turn) that
	//   - the reconcile effect must NOT honour: syncing `messages` to the empty
	//     server snapshot would WIPE the answer (and the optimistic user turn).
	// Cleared on a fresh writeMessage (a resend supersedes the fallback) and reset
	// naturally on conversation change / remount. The answer is transient — gone on
	// reload — which is correct, since nothing was ever persisted.
	let cacheFallbackConvId = $state<string | null>(null);

	let files: File[] = $state([]);

	function createMessagesPath<T>(messages: TreeNode<T>[], msgId?: TreeId): TreeNode<T>[] {
		if (initialRun) {
			if (!msgId && page.url.searchParams.get("leafId")) {
				msgId = page.url.searchParams.get("leafId") as string;
				page.url.searchParams.delete("leafId");
			}
			if (!msgId && browser && localStorage.getItem("leafId")) {
				msgId = localStorage.getItem("leafId") as string;
			}
			initialRun = false;
		}

		const msg = messages.find((msg) => msg.id === msgId) ?? messages.at(-1);
		if (!msg) return [];
		// ancestor path
		const { ancestors } = msg;
		const path = [];
		if (ancestors?.length) {
			for (const ancestorId of ancestors) {
				const ancestor = messages.find((msg) => msg.id === ancestorId);
				if (ancestor) {
					path.push(ancestor);
				}
			}
		}

		// push the node itself in the middle
		path.push(msg);

		// children path
		let childrenIds = msg.children;
		while (childrenIds?.length) {
			let lastChildId = childrenIds.at(-1);
			const lastChild = messages.find((msg) => msg.id === lastChildId);
			if (lastChild) {
				path.push(lastChild);
			}
			childrenIds = lastChild?.children;
		}

		return path;
	}

	function createMessagesAlternatives<T>(messages: TreeNode<T>[]): TreeId[][] {
		const alternatives = [];
		for (const message of messages) {
			if (message.children?.length) {
				alternatives.push(message.children);
			}
		}
		return alternatives;
	}

	// this function is used to send new message to the backends
	async function writeMessage({
		prompt,
		messageId = messagesPath.at(-1)?.id ?? undefined,
		isRetry = false,
		searchContext,
	}: {
		prompt?: string;
		messageId?: ReturnType<typeof v4>;
		isRetry?: boolean;
		searchContext?: SearchContext;
	}): Promise<void> {
		// Time-to-first-token watchdog state (see where it's armed, below). Declared
		// at function scope so the finally can always clear the timer.
		let firstTokenWatchdog: ReturnType<typeof setTimeout> | undefined;
		let firstContentSeen = false;
		let watchdogTimedOut = false;
		// Assigned inside the try once the target message exists; called from the
		// after-loop, the no-iterator early return, AND the catch — hence function
		// scope rather than a try-local const.
		let applyEarlyStreamFailure: (() => Promise<void>) | undefined;
		try {
			stopRequestedFor = null;
			$isAborted = false;
			$loading = true;
			pending = true;
			// A fresh attempt (incl. a resend) supersedes any prior client-only cache
			// fallback for this conversation; re-enable the normal server reconcile.
			cacheFallbackConvId = null;
			writeMessageInFlight = true;
			// Create the controller before any await: a Stop click during file
			// encoding or MCP hydration must abort THIS request, not whichever
			// stale controller a previous generation left behind.
			messageUpdatesAbortController = new AbortController();
			activeGenerationId = v4();
			const base64Files = await Promise.all(
				(files ?? []).map((file) =>
					file2base64(file).then((value) => ({
						type: "base64" as const,
						value,
						mime: file.type,
						name: file.name,
					}))
				)
			);

			let messageToWriteToId: Message["id"] | undefined = undefined;
			// used for building the prompt, subtree of the conversation that goes from the latest message to the root

			if (isRetry && messageId) {
				// two cases, if we're retrying a user message with a newPrompt set,
				// it means we're editing a user message
				// if we're retrying on an assistant message, newPrompt cannot be set
				// it means we're retrying the last assistant message for a new answer

				const messageToRetry = messages.find((message) => message.id === messageId);

				if (!messageToRetry) {
					$error = "Message not found";
				}

				if (messageToRetry?.from === "user" && prompt) {
					// add a sibling to this message from the user, with the alternative prompt
					// add a children to that sibling, where we can write to
					const newUserMessageId = addSibling(
						{
							messages,
							rootMessageId,
						},
						{
							from: "user",
							content: prompt,
							files: messageToRetry.files,
						},
						messageId
					);
					messageToWriteToId = addChildren(
						{
							messages,
							rootMessageId,
						},
						{ from: "assistant", content: "" },
						newUserMessageId
					);
				} else if (messageToRetry?.from === "assistant") {
					// we're retrying an assistant message, to generate a new answer
					// just add a sibling to the assistant answer where we can write to
					messageToWriteToId = addSibling(
						{
							messages,
							rootMessageId,
						},
						{ from: "assistant", content: "" },
						messageId
					);
				}
			} else {
				// just a normal linear conversation, so we add the user message
				// and the blank assistant message back to back
				const newUserMessageId = addChildren(
					{
						messages,
						rootMessageId,
					},
					{
						from: "user",
						content: prompt ?? "",
						files: base64Files,
					},
					messageId
				);

				if (!rootMessageId) {
					rootMessageId = newUserMessageId;
				}

				messageToWriteToId = addChildren(
					{
						messages,
						rootMessageId,
					},
					{
						from: "assistant",
						content: "",
					},
					newUserMessageId
				);
			}

			const userMessage = messages.find((message) => message.id === messageId);
			const messageToWriteTo = messages.find((message) => message.id === messageToWriteToId);
			if (!messageToWriteTo) {
				throw new Error("Message to write to not found");
			}

			// Mirror the server's webSearch stamp on the client message so the
			// citations strip + map highlight appear live during streaming, not only
			// after the post-stream reload re-hydrates from the DB. Shape owned by
			// searchProvenance (shared with the server stamp) so the two can't drift.
			const webSearchProvenance = searchProvenance(searchContext);
			if (webSearchProvenance) {
				messageToWriteTo.webSearch = webSearchProvenance;
			}

			const streamingMode = resolveStreamingMode($settings);

			// Mark the moment real output starts (first token, or a final answer that
			// arrives without prior streaming) so the watchdog below stands down.
			const markFirstContent = () => {
				firstContentSeen = true;
				if (firstTokenWatchdog) {
					clearTimeout(firstTokenWatchdog);
					firstTokenWatchdog = undefined;
				}
			};

			// EARLY-failure path: the watchdog fired before anything rendered — the
			// connection stalled at setup, or the stream died before the first token
			// (the conference-wifi hang). Without this the for-await below would await
			// forever and the "…" spinner would never clear.
			//
			// Live-first resilience: on failure (only) look up a pre-vetted starter
			// answer. On a HIT render the real dated Apertus output — same content
			// surface as live (answer text + cited sources + asOf), no "cached" badge,
			// so nothing misleads. On a MISS fall back to a retryable message; since no
			// tokens streamed, the turn is safe to resend.
			applyEarlyStreamFailure = async () => {
				const cached = await getCachedAnswer(prompt ?? "", { base });
				if (cached) {
					messageToWriteTo.content = cached.answer;
					// Transient honesty marker (client-render-only, never persisted): this turn
					// was served from a pre-vetted starter answer because the live request never
					// reached the server. ChatMessage renders an honesty chip off it.
					messageToWriteTo.servedFromCache = true;
					if (cached.sources.length > 0) {
						messageToWriteTo.webSearch = {
							query: prompt ?? "",
							sources: cached.sources,
							asOf: cached.asOf ?? "",
						};
					}
					// Mark the conversation as carrying a client-only cache answer so the
					// generation-state effect treats the turn as finished (no spinner, no
					// background-generation registration) and the reconcile effect refuses
					// to overwrite it with the empty server snapshot (see flag declaration).
					cacheFallbackConvId = convId;
					return;
				}
				$error = ERROR_MESSAGES.connectionLost;
			};

			// Time-to-first-token watchdog (cause-agnostic). fetch() has no timeout, and
			// a stream can stall or die before the first token with neither a token nor
			// an error — so the for-await below can hang the spinner indefinitely. If
			// nothing arrives within the window, abort (unsticking any hung read) and
			// take the EARLY-failure path.
			//
			// The window is re-armed on every inbound update (below), so this is purely
			// a DEAD-CONNECTION detector: it fires only on TOTAL silence. A legitimately
			// slow turn — e.g. a grounded answer doing >8s of retrieval, emitting status
			// or keep-alive updates before the first answer token — keeps re-arming and
			// is never false-tripped. The dead-connection regime it guards against
			// produces no updates at all, so there is nothing to re-arm it with.
			const FIRST_TOKEN_TIMEOUT_MS = 8000;
			const armFirstTokenWatchdog = () => {
				if (firstTokenWatchdog) clearTimeout(firstTokenWatchdog);
				firstTokenWatchdog = setTimeout(() => {
					if (firstContentSeen || $isAborted) return;
					watchdogTimedOut = true;
					messageUpdatesAbortController.abort();
				}, FIRST_TOKEN_TIMEOUT_MS);
			};
			armFirstTokenWatchdog();

			const messageUpdatesIterator = await fetchMessageUpdates(
				convId,
				{
					base,
					inputs: prompt,
					messageId,
					isRetry,
					generationId: activeGenerationId,
					files: isRetry ? userMessage?.files : base64Files,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					streamingMode,
					searchContext,
				},
				messageUpdatesAbortController.signal
			).catch((err) => {
				// W2 idempotency: a 409 means this generationId is already running/finished server-side (a
				// duplicate POST from a network auto-retry). Don't toast and don't re-submit — attach to the
				// existing run by registering it as a background generation (the SSE poller delivers its
				// completion) and refresh the conversation so the in-flight/finished turn surfaces.
				if (err instanceof GenerationConflictError) {
					addBackgroundGeneration({ id: convId, startedAt: Date.now() });
					void safeInvalidate(UrlDependency.Conversation);
					return;
				}
				// A user abort rejects the fetch; that is not an error worth a toast
				if (!$isAborted && !(err instanceof DOMException && err.name === "AbortError")) {
					error.set(err.message);
				}
			});
			if (messageUpdatesIterator === undefined) {
				// The connection itself never produced an iterator. If our watchdog
				// aborted it (a setup stall), take the EARLY-failure path; the finally
				// still resets the spinner.
				if (watchdogTimedOut) await applyEarlyStreamFailure?.();
				return;
			}

			files = [];
			let buffer = "";
			// Initialize lastUpdateTime outside the loop to persist between updates
			let lastUpdateTime = new Date();
			let frameFlushScheduled = false;

			const flushBuffer = (currentTime: Date) => {
				if (buffer.length === 0) return;
				messageToWriteTo.content += buffer;
				buffer = "";
				lastUpdateTime = currentTime;
			};

			const scheduleFrameFlush = () => {
				if (frameFlushScheduled) return;
				frameFlushScheduled = true;
				const flush = () => {
					frameFlushScheduled = false;
					flushBuffer(new Date());
				};
				if (typeof requestAnimationFrame === "function") {
					requestAnimationFrame(flush);
				} else {
					setTimeout(flush, 0);
				}
			};

			for await (const update of messageUpdatesIterator) {
				if ($isAborted) {
					messageUpdatesAbortController.abort();
					return;
				}

				// Any inbound update proves the connection is alive: re-arm the
				// first-token watchdog so a legitimately slow turn (long retrieval
				// before the first token) isn't aborted as a false positive. Once real
				// content is seen the watchdog is cleared for good, so this is a no-op
				// after that point.
				if (!firstContentSeen) armFirstTokenWatchdog();

				// Remove null characters added due to remote keylogging prevention
				// See server code for more details
				if (update.type === MessageUpdateType.Stream) {
					update.token = update.token.replaceAll("\0", "");
				}

				const isKeepAlive =
					update.type === MessageUpdateType.Status &&
					update.status === MessageUpdateStatus.KeepAlive;

				if (!isKeepAlive) {
					if (update.type === MessageUpdateType.Stream) {
						const existingUpdates = messageToWriteTo.updates ?? [];
						const lastUpdate = existingUpdates.at(-1);
						if (lastUpdate?.type === MessageUpdateType.Stream) {
							// Create fresh objects/arrays so the UI reacts to merged tokens
							const merged = {
								...lastUpdate,
								token: (lastUpdate.token ?? "") + (update.token ?? ""),
							};
							messageToWriteTo.updates = [...existingUpdates.slice(0, -1), merged];
						} else {
							messageToWriteTo.updates = [...existingUpdates, update];
						}
					} else {
						messageToWriteTo.updates = [...(messageToWriteTo.updates ?? []), update];
					}
				}
				const currentTime = new Date();

				// If we receive a non-stream update (e.g. tool/status/final answer),
				// flush any buffered stream tokens so the UI doesn't appear to cut
				// mid-sentence while tools are running or the final answer arrives.
				if (update.type !== MessageUpdateType.Stream && buffer.length > 0) {
					flushBuffer(currentTime);
				}

				if (update.type === MessageUpdateType.Stream) {
					buffer += update.token;
					if (streamingMode === "smooth") {
						// Coalesce UI updates to animation frames for smooth mode.
						scheduleFrameFlush();
					} else if (
						currentTime.getTime() - lastUpdateTime.getTime() >
						updateDebouncer.maxUpdateTime
					) {
						flushBuffer(currentTime);
					}
					if (pending) {
						streamStart();
					}
					pending = false;
					markFirstContent();
				} else if (update.type === MessageUpdateType.FinalAnswer) {
					// Real output has arrived (possibly as a single final answer with no
					// prior streaming) — stand the watchdog down.
					markFirstContent();
					// Mirror server-side merge behavior so the UI reflects the
					// final text once tools complete, while preserving any
					// pre‑tool streamed content when appropriate.
					const finalText = update.text ?? "";
					const isInterrupted = update.interrupted === true;
					// Tools/MCP removed (B1-lite strip) — no tool updates are ever produced.
					const hadTools = false;

					if (isInterrupted) {
						if (!messageToWriteTo.content) {
							// We never streamed anything; fall back to finalText.
							messageToWriteTo.content = finalText;
						} else if (finalText && messageToWriteTo.content.startsWith(finalText)) {
							// The server may have clamped the persisted text back to a
							// reported stop point (see stop-generating). Adopt it when it
							// is a prefix of what we streamed so this view matches what
							// every other view will load; otherwise keep our streamed
							// content (continue flows receive only the post-prefix text).
							messageToWriteTo.content = finalText;
						}
					} else if (hadTools) {
						const existing = messageToWriteTo.content;
						const trimmedExistingSuffix = existing.replace(/\s+$/, "");
						const trimmedFinalPrefix = finalText.replace(/^\s+/, "");
						const alreadyStreamed =
							finalText &&
							(existing.endsWith(finalText) ||
								(trimmedFinalPrefix.length > 0 &&
									trimmedExistingSuffix.endsWith(trimmedFinalPrefix)));

						if (existing && existing.length > 0) {
							if (alreadyStreamed) {
								// A. Already streamed the same final text; keep as-is.
								messageToWriteTo.content = existing;
							} else if (
								finalText &&
								(finalText.startsWith(existing) ||
									(trimmedExistingSuffix.length > 0 &&
										trimmedFinalPrefix.startsWith(trimmedExistingSuffix)))
							) {
								// B. Final text already includes streamed prefix; use it verbatim.
								messageToWriteTo.content = finalText;
							} else {
								// C. Merge with a paragraph break for readability.
								const needsGap = !/\n\n$/.test(existing) && !/^\n/.test(finalText ?? "");
								messageToWriteTo.content = existing + (needsGap ? "\n\n" : "") + finalText;
							}
						} else {
							messageToWriteTo.content = finalText;
						}
					} else {
						// No tools: final answer replaces streamed content so
						// the provider's final text is authoritative.
						messageToWriteTo.content = finalText;
					}
				} else if (
					update.type === MessageUpdateType.Status &&
					update.status === MessageUpdateStatus.Error
				) {
					// 402 (HuggingChat PRO upsell) removed — our serving has no billing/accounts;
					// a stray 402 now falls through to the generic error below.
					if (
						update.statusCode === 401 &&
						typeof update.message === "string" &&
						/oauth authorization|has been revoked|requested scopes/i.test(update.message)
					) {
						// The stored OAuth token was revoked or no longer matches scopes.
						// Restart the OAuth flow and return to this conversation afterwards.
						const next = encodeURIComponent(`${base}/conversation/${convId}`);
						window.location.assign(`${base}/login?next=${next}`);
					} else {
						$error = update.message ?? "An error has occurred";
					}
				} else if (update.type === MessageUpdateType.Title) {
					// Update the sidebar title directly via the store — no side-channel needed.
					convsStore.update(convId, { title: update.title });
				} else if (update.type === MessageUpdateType.File) {
					messageToWriteTo.files = [
						...(messageToWriteTo.files ?? []),
						{ type: "hash", value: update.sha, mime: update.mime, name: update.name },
					];
				} else if (update.type === MessageUpdateType.RouterMetadata) {
					// Update router metadata immediately when received
					messageToWriteTo.routerMetadata = {
						route: update.route,
						model: update.model,
					};
				} else if (update.type === MessageUpdateType.AgentStep) {
					// Agent step (Story B): the agent service advanced one execution step. Beat BOTH the
					// Apertus model node and the Hermes agent node — each step IS the sovereign model
					// working, driven by the agent loop, so pulsing both keeps the animation coherent with
					// the provenance badge (which centers on the Apertus node). The step text itself streams
					// in the <think> block; this is the ambient map animation.
					if (browser) {
						window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: ["apertus", "hermes"] } }));
					}
				} else if (update.type === MessageUpdateType.Safety) {
					// A safety decline is a real terminal response (just not a token), so stand
					// the watchdog down — it must not later clobber the decline with a fallback.
					markFirstContent();
					// Safety pre-screen declined this turn before the model ran. Stamp the marker
					// so the answer renders as a safety decline (no Apertus provenance badge) and
					// the live-stack map highlights the toxic-bert node. Shape owned by
					// moderationMarker (shared with the server stamp) so the two can't drift.
					messageToWriteTo.moderation = moderationMarker({
						label: update.label,
						score: update.score,
						kind: update.kind,
					});
				}
			}

			if (buffer.length > 0) {
				flushBuffer(new Date());
			}

			// The watchdog aborted before any token rendered, which ends the stream
			// cleanly (reader.cancel resolves the read as done) rather than throwing —
			// so handle the EARLY-failure path here too, not just in catch.
			if (watchdogTimedOut && !firstContentSeen) {
				await applyEarlyStreamFailure?.();
			}
		} catch (err) {
			if ($isAborted || (err instanceof DOMException && err.name === "AbortError")) {
				// The watchdog also aborts the request, which on some platforms surfaces
				// here as a thrown AbortError rather than a clean stream end. If that's why
				// we're here (no user Stop, nothing rendered), take the EARLY-failure path;
				// otherwise this is a genuine user Stop, not an error.
				if (watchdogTimedOut && !firstContentSeen) {
					await applyEarlyStreamFailure?.();
				}
			} else if (err instanceof Error && err.message.includes("overloaded")) {
				$error = "Too much traffic, please try again.";
			} else if (err instanceof Error && err.message.includes("429")) {
				$error = ERROR_MESSAGES.rateLimited;
			} else if (!firstContentSeen && applyEarlyStreamFailure) {
				// EARLY failure: a non-abort stream/connection error threw before any
				// token rendered — same regime as the watchdog timeout, so take the same
				// path (cached answer if we have one, else a retryable message) rather
				// than surfacing a raw browser error string. Guarded on the handler being
				// assigned: an error thrown before that point falls through to a real message.
				await applyEarlyStreamFailure();
			} else if (err instanceof Error) {
				// LATE failure: a partial answer is already on screen — keep it and
				// surface the error rather than replacing it with a fallback.
				$error = err.message;
			} else {
				$error = ERROR_MESSAGES.default;
			}
			console.error(err);
		} finally {
			// Always clear the watchdog so a late fire can't abort a later request.
			if (firstTokenWatchdog) {
				clearTimeout(firstTokenWatchdog);
				firstTokenWatchdog = undefined;
			}
			writeMessageInFlight = false;
			activeGenerationId = undefined;
			$loading = false;
			pending = false;
			// Wait for the stop request to complete before refreshing data,
			// so the abort marker is durably written before we poll for the
			// terminal state below.
			if (stopRequestPromise) {
				await stopRequestPromise.catch(() => {});
				stopRequestPromise = undefined;
			}
			const stoppedHere = stopRequestedFor === convId;
			// Only re-run the loads that actually need fresh data: the
			// conversation page (new messages) and the sidebar list
			// (updated title / updatedAt via client-owned store refresh).
			// Avoids the 5 redundant bootstrap requests (models, settings, user,
			// public-config, feature-flags) that a full invalidateAll() would trigger.
			// When this finally runs because beforeNavigate aborted the stream
			// ($isAborted set without a stop click), invalidating would cancel
			// that very navigation (e.g. the "New Chat" click that triggered
			// the abort) before the router even exposes it via `navigating`.
			// Skip the refresh: the destination page loads its own data.
			const abortedByNavigation = $isAborted && !stoppedHere;
			if (!abortedByNavigation) {
				// stop-generating returns as soon as the abort marker is written,
				// NOT when the generating pod has persisted interrupted:true.
				// Invalidating right away would load a non-terminal snapshot that
				// wipes the optimistic interrupted flag and shows a stuck
				// streaming state. Wait (bounded) for the persisted state to
				// become terminal before refreshing.
				if (stoppedHere) {
					await waitForTerminalPersist(convId);
				}
				if (cacheFallbackConvId === convId) {
					// The connection dropped before the server persisted this turn, so we
					// painted a pre-vetted cached answer client-side. A conversation
					// re-sync here would reconcile `messages` back to the empty/partial
					// server snapshot and WIPE that answer (and the optimistic user turn),
					// leaving a silently empty conversation. Skip the reload; still refresh
					// the sidebar, which reads its own store. The cached answer is transient
					// (gone on navigation/reload) — correct, since nothing was persisted;
					// the user can resend to get a real, persisted turn.
					await convsStore.refresh();
				} else {
					await Promise.all([
						safeInvalidate(UrlDependency.Conversation),
						convsStore.refresh(),
					]);
				}
			}
		}
	}

	// Poll the conversation API until the last assistant message is terminal
	// (interrupted, final answer, or error persisted), bounded at ~3.2s. Used
	// after a Stop so the post-stop refresh reads settled data instead of a
	// mid-abort snapshot.
	async function waitForTerminalPersist(id: string) {
		const client = useAPIClient();
		for (let attempt = 0; attempt < 8; attempt++) {
			try {
				const conversation = (await client.conversations({ id }).get().then(handleResponse)) as {
					messages: Message[];
				};
				if (!isConversationGenerationActive(conversation.messages)) return;
			} catch {
				return; // cannot verify; fall through to the single refresh
			}
			await new Promise((resolve) => setTimeout(resolve, 400));
		}
	}

	async function stopGeneration() {
		// Snapshot the stop point first: the generation run this tab started
		// (if any) and how many characters of the reply are on screen right
		// now. The server clamps the persisted text back to this so the
		// interrupted message cannot "grow back" past what the user saw while
		// the abort marker was in flight.
		const lastAssistant = messages.findLast((m) => m.from === "assistant");
		const stopPoint =
			activeGenerationId !== undefined && lastAssistant
				? { generationId: activeGenerationId, seenContentLength: lastAssistant.content.length }
				: undefined;

		stopRequestedFor = convId;
		$isAborted = true;
		$loading = false;
		messageUpdatesAbortController.abort();

		// Mark the last assistant message as interrupted locally so
		// isConversationGenerationActive() immediately returns false,
		// removing the background poller and preventing $loading re-enable.
		if (lastAssistant) {
			lastAssistant.interrupted = true;
		}

		const sendStopRequest = async () => {
			const response = await fetch(`${base}/conversation/${page.params.id}/stop-generating`, {
				method: "POST",
				...(stopPoint && {
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(stopPoint),
				}),
			});
			if (!response.ok) {
				throw new Error(`Stop request failed: ${response.status}`);
			}
		};

		// Store the promise so writeMessage's finally block can await it
		// before refreshing data. Losing this request entirely means the server
		// never learns about the stop (the abort marker is what cross-pod
		// generation watchers act on), so retry with backoff instead of giving
		// up after a single transient failure.
		stopRequestPromise = (async () => {
			const delays = [0, 300, 1000, 3000];
			for (const [attempt, delay] of delays.entries()) {
				if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
				try {
					await sendStopRequest();
					return;
				} catch (err) {
					if (attempt === delays.length - 1) {
						console.error("Failed to stop generation", err);
						$error = "Failed to stop generation. Please try again.";
					}
				}
			}
		})();

		await stopRequestPromise;
	}

	function handleKeydown(event: KeyboardEvent) {
		// Stop generation on ESC key when loading
		if (event.key === "Escape" && $loading) {
			event.preventDefault();
			stopGeneration();
		}
	}

	onMount(async () => {
		// Read the first message from SvelteKit shallow-routing history state.
		// Text is serialized directly; File objects travel via the pendingFiles
		// client-side Map, retrieved once by nonce and then discarded.
		// On a hard refresh page.state is empty, so both values are undefined
		// and we skip straight to the background-generation check below.
		const pendingText = page.state.pendingMessage as string | undefined;
		if (pendingText) {
			const nonce = page.state.pendingFilesNonce as string | undefined;
			files = nonce ? consumePendingFiles(nonce) : [];
			// A web-search-grounded first message carries its searchContext through
			// the same history state as the prompt (set in the home page's
			// createConversation), so the new conversation's first turn is grounded.
			const pendingSearch = page.state.pendingSearchContext as SearchContext | undefined;
			// Clear the history entry before submitting: returning to it via
			// Back/Forward re-runs onMount, and a lingering pendingMessage
			// would resubmit the prompt (without files, whose nonce is spent).
			replaceState("", {});
			await writeMessage({ prompt: pendingText, searchContext: pendingSearch });
		}

		// Don't resume tracking for stale snapshots: a generation that has gone
		// this long without a DB write died with its pod and will never finish.
		// Also skip a turn that just resolved to a client-only cache fallback: the
		// cache-painted assistant has no terminal update, so it would otherwise read
		// as active and register a background generation whose poller then wipes it.
		const streaming =
			cacheFallbackConvId !== convId &&
			isConversationGenerationActive(messages) &&
			!isGenerationStale(data.updatedAt);
		if (streaming) {
			addBackgroundGeneration({ id: convId, startedAt: Date.now() });
			$loading = true;
		}
	});

	async function onMessage(content: string, opts?: { searchContext?: SearchContext }) {
		await writeMessage({ prompt: content, searchContext: opts?.searchContext });
	}

	async function onRetry(payload: { id: Message["id"]; content?: string }) {
		if (requireAuthUser()) return;

		const lastMsgId = payload.id;
		messagesPath = createMessagesPath(messages, lastMsgId);

		await writeMessage({
			prompt: payload.content,
			messageId: payload.id,
			isRetry: true,
		});
	}

	async function onShowAlternateMsg(payload: { id: Message["id"] }) {
		const msgId = payload.id;
		messagesPath = createMessagesPath(messages, msgId);
	}

	const settings = useSettingsStore();
	let messages = $state(untrack(() => data.messages));
	// Local copy of rootMessageId avoids mutating the load-data prop directly.
	// It is set when the first message of a new conversation is created, and
	// re-synced from server data whenever the conversation changes.
	let rootMessageId = $state(untrack(() => data.rootMessageId));

	// Resync local message state from server data ONLY when the conversation
	// changes (sidebar navigation) or the load data itself was refreshed
	// (post-stream invalidation). Two hard constraints, both learned from
	// prod incidents:
	//
	// 1. `pending` must NOT be a reactive dependency of this effect. It flips
	//    false when the first streaming token arrives; reading it tracked made
	//    that flip re-run the effect and overwrite the locally appended
	//    user/assistant messages with the stale page-load snapshot, blanking
	//    the conversation until the stream finished (prod incident 2026-06-11).
	//    It is therefore only ever read inside untrack().
	// 2. A sync may only happen when `data.messages` identity actually changed
	//    (or the conversation changed): re-running this effect for any other
	//    reason must be a no-op.
	//
	// A mid-stream load refresh (pending still true) is intentionally skipped;
	// the finally block in writeMessage invalidates again after the stream
	// ends, so the post-completion sync still lands.
	let _lastSyncedConvId = untrack(() => convId); // plain variable — no reactive overhead needed
	let _lastSyncedMessages = untrack(() => data.messages); // plain variable — identity tracking only
	$effect(() => {
		const currentConvId = convId; // reactive dep
		const newMessages = data.messages; // reactive dep

		const convChanged = currentConvId !== _lastSyncedConvId;
		const dataChanged = newMessages !== _lastSyncedMessages;

		// Additionally: a client-only cache fallback is painted for THIS conversation
		// (the server never recorded the turn), so a data-driven sync would reconcile
		// `messages` to the empty server snapshot and wipe the answer. Treat it like
		// `pending` and block the data-change sync (read untracked, same as `pending`,
		// per constraint #1). A genuine conversation change still syncs — the guard is
		// keyed to the current conv id, never set for a conv we're navigating to — and
		// a resend clears the flag.
		const cacheFallbackHere = untrack(() => cacheFallbackConvId) === currentConvId;

		if (convChanged || (dataChanged && untrack(() => !pending) && !cacheFallbackHere)) {
			messages = newMessages;
			rootMessageId = data.rootMessageId;
			_lastSyncedConvId = currentConvId;
			_lastSyncedMessages = newMessages;
		}
	});

	$effect(() => {
		const streaming =
			// A client-only cache fallback for this conv is a FINISHED turn, not an
			// active generation: its assistant carries no terminal update, so without
			// this guard it would keep the spinner on and re-register a background
			// generation (whose poller wipes it). Tracked, so the flag flipping at
			// watchdog time re-runs this effect and clears the spinner immediately.
			cacheFallbackConvId !== convId &&
			isConversationGenerationActive(messages) &&
			// A snapshot that has gone this long without a database write belongs
			// to a pod that died before persisting a terminal state; never
			// resurrect the streaming UI for it. Generations streaming in this
			// tab are exempt — their snapshot timestamp is from page-load time.
			(untrack(() => writeMessageInFlight) || !isGenerationStale(data.updatedAt));
		if (stopRequestedFor === convId) {
			$loading = false;
		} else if (streaming) {
			$loading = true;
		} else if (!pending) {
			$loading = false;
		}

		if (!streaming && browser) {
			removeBackgroundGeneration(convId);
		}
	});

	// create a linear list of `messagesPath` from `messages` that is a tree of threaded messages
	let messagesPath = $derived(createMessagesPath(messages));
	let messagesAlternatives = $derived(createMessagesAlternatives(messages));

	$effect(() => {
		if (browser && messagesPath.at(-1)?.id) {
			localStorage.setItem("leafId", messagesPath.at(-1)?.id as string);
		}
	});

	beforeNavigate((navigation) => {
		if (!page.params.id) return;

		const navigatingAway =
			navigation.to?.route.id !== page.route.id || navigation.to?.params?.id !== page.params.id;

		if ($loading && navigatingAway) {
			addBackgroundGeneration({ id: page.params.id, startedAt: Date.now() });
		}

		$isAborted = true;
		$loading = false;
		messageUpdatesAbortController.abort();
	});

	let title = $derived.by(() => {
		const rawTitle =
			convsStore.list.find((conv) => conv.id === page.params.id)?.title ?? data.title;
		return rawTitle ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1) : rawTitle;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{title}</title>
</svelte:head>

<ChatWindow
	loading={$loading}
	{pending}
	messages={messagesPath as Message[]}
	{messagesAlternatives}
	shared={data.shared}
	preprompt={data.preprompt}
	bind:files
	onmessage={onMessage}
	onretry={onRetry}
	onshowAlternateMsg={onShowAlternateMsg}
	onstop={stopGeneration}
	models={data.models}
	currentModel={findCurrentModel(data.models, data.oldModels, data.model)}
/>

