import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { config } from "$lib/server/config";
import { models, validModelIdSchema } from "$lib/server/models";
import { error } from "@sveltejs/kit";
import { ObjectId } from "bson";
import { z } from "zod";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "$lib/constants/fileSize";
import { enforceRequestRateLimits } from "$lib/server/chat/rateLimit";
import { chatRequestSchema } from "$lib/server/chat/requestSchema";
import { appendTurnMessages } from "$lib/server/chat/messageTree";
import { applyMessageUpdate, createStreamState } from "$lib/server/chat/streamUpdate";
import {
	MessageUpdateStatus,
	MessageUpdateType,
	type MessageUpdate,
	type MessageStreamUpdate,
} from "$lib/types/MessageUpdate";
import { uploadFile } from "$lib/server/files/uploadFile";
import { MULTIMODAL_ENABLED } from "$lib/server/textOnly";
import {
	moderateMessage,
	checkChildSafety,
	MODERATION_DECLINE,
	CHILD_SAFETY_DECLINE,
} from "$lib/server/moderation";
import { searchProvenance, moderationMarker } from "$lib/messageProvenance";
import { convertLegacyConversation } from "$lib/utils/tree/convertLegacyConversation";
import { usageLimits } from "$lib/server/usageLimits";
import { textGeneration } from "$lib/server/textGeneration";
import type { TextGenerationContext } from "$lib/server/textGeneration/types";
import { logger } from "$lib/server/logger.js";
import { AbortRegistry } from "$lib/server/abortRegistry";
import { clampStoppedContent } from "$lib/server/stopTruncation";
import { MetricsServer } from "$lib/server/metrics";
import { deleteConversationsCascade } from "$lib/server/db/deleteConversations";
import { claimGeneration, readGeneration, finishGeneration } from "$lib/server/generations";

// How long a stop marker is protected from the pre-flight cleanup of a new
// generation. A marker younger than this may still be awaiting observation by
// a running generation's 300ms watcher (possibly on another pod); deleting it
// would lose the stop. Aborted generations consume their marker on shutdown,
// so markers normally live far shorter than this.
const STOP_MARKER_GRACE_MS = 5_000;

export async function POST({ request, locals, params, getClientAddress }) {
	const id = z.string().parse(params.id);
	const convId = new ObjectId(id);
	const promptedAt = new Date();

	const userId = locals.user?._id ?? locals.sessionId;

	// check user
	if (!userId) {
		error(401, "Unauthorized");
	}

	// check if the user has access to the conversation
	const convBeforeCheck = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (convBeforeCheck && !convBeforeCheck.rootMessageId) {
		const res = await collections.conversations.updateOne(
			{
				_id: convId,
			},
			{
				$set: {
					...convBeforeCheck,
					...convertLegacyConversation(convBeforeCheck),
				},
			}
		);

		if (!res.acknowledged) {
			error(500, "Failed to convert conversation");
		}
	}

	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conv) {
		error(404, "Conversation not found");
	}

	// A new generation invalidates any stale stop marker for this conversation.
	// The abortedGenerations collection is the cross-pod abort channel:
	// stop-generating upserts a marker, and the watcher in the stream below
	// polls it. Clearing stale markers here — before the client could possibly
	// issue a stop for THIS generation (its fetch has not returned yet) — means
	// any marker observed later was meant for us, with no wall-clock comparison
	// between pods needed. Markers younger than the grace window are preserved:
	// they belong to a stop for a still-winding-down generation in this same
	// conversation (e.g. issued from another tab), whose watcher must get the
	// chance to observe them; aborted generations consume their marker on
	// shutdown, so a fresh marker is never a stale one.
	await collections.abortedGenerations.deleteOne({
		conversationId: convId,
		updatedAt: { $lt: new Date(Date.now() - STOP_MARKER_GRACE_MS) },
	});

	// Per-turn rate limits (per-session, opt-in per-IP, service-wide daily cap). All fail open on a
	// DB blip; only an actual over-limit count throws a 429. See $lib/server/chat/rateLimit.
	await enforceRequestRateLimits({ userId, clientAddress: getClientAddress() });

	if (usageLimits?.messages && conv.messages.length > usageLimits.messages) {
		error(
			429,
			`This conversation has more than ${usageLimits.messages} messages. Start a new one to continue`
		);
	}

	// fetch the model
	const model = models.find((m) => m.id === conv.model);

	if (!model) {
		error(410, "Model not available anymore");
	}

	// finally parse the content of the request
	const form = await request.formData();

	const json = form.get("data");

	if (!json || typeof json !== "string") {
		error(400, "Invalid request");
	}

	const {
		inputs: newPrompt,
		id: messageId,
		is_retry: isRetry,
		generationId,
		selectedMcpServerNames,
		selectedMcpServers,
		timezone,
		searchContext,
	} = chatRequestSchema.parse(JSON.parse(json));

	// Attach MCP selection to locals so the text generation pipeline can consume it.
	// FORWARD-LOOKING: nothing reads locals.mcp yet — MCP tools are gated off for the alpha.
	// The read side (thread this into maybeRunMcpTool, see $lib/server/mcp) lands when tools
	// re-enable, post-alpha alongside the Apertus 1.5 8B release. Kept wired so re-enabling is
	// a read-side change only.
	try {
		locals.mcp = {
			selectedServerNames: selectedMcpServerNames,
			selectedServers: (selectedMcpServers ?? []).map((s) => ({
				name: s.name,
				url: s.url,
				headers:
					s.headers && s.headers.length > 0
						? Object.fromEntries(s.headers.map((h) => [h.key, h.value]))
						: undefined,
			})),
		};
	} catch {
		// ignore attachment errors, pipeline will just use env servers
	}

	// Attach user timezone so the tool prompt can include localized time. Same status as
	// locals.mcp above: forward-looking, consumed when MCP tools re-enable post-alpha.
	if (timezone) {
		locals.timezone = timezone;
	}

	const inputFiles = await Promise.all(
		form
			.getAll("files")
			.filter((entry): entry is File => entry instanceof File && entry.size > 0)
			.map(async (file) => {
				const [type, ...name] = file.name.split(";");

				return {
					type: z.literal("base64").or(z.literal("hash")).parse(type),
					value: await file.text(),
					mime: file.type,
					name: name.join(";"),
				};
			})
	);

	// TEXT-ONLY ALPHA (until July 9): reject any attachment server-side. The UI hides upload, but
	// enforce it here too so a crafted request can't slip a file/image through. Gated, not removed —
	// flip MULTIMODAL_ENABLED post-July. See $lib/server/textOnly.
	if (!MULTIMODAL_ENABLED && inputFiles.length > 0) {
		error(415, "Attachments are disabled — this alpha is text-only.");
	}

	if (usageLimits?.messageLength && (newPrompt?.length ?? 0) > usageLimits.messageLength) {
		error(400, "Message too long.");
	}

	// each file is either:
	// base64 string requiring upload to the server
	// hash pointing to an existing file
	const hashFiles = inputFiles?.filter((file) => file.type === "hash") ?? [];
	const b64Files =
		inputFiles
			?.filter((file) => file.type !== "hash")
			.map((file) => {
				const blob = Buffer.from(file.value, "base64");
				return new File([blob], file.name, { type: file.mime });
			}) ?? [];

	// check sizes — cap + label come from the shared constant (see $lib/constants/fileSize)
	if (b64Files.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
		error(413, `File too large, should be <${MAX_FILE_SIZE_LABEL}`);
	}

	const uploadedFiles = await Promise.all(b64Files.map((file) => uploadFile(file, conv))).then(
		(files) => [...files, ...hashFiles]
	);

	// Append this turn's message(s) to the conversation tree (normal / retry / edit) and get the
	// assistant message to stream into plus the prompt subtree. See $lib/server/chat/messageTree.
	const { messageToWriteToId, messagesForPrompt } = appendTurnMessages(conv, {
		isRetry,
		messageId,
		newPrompt,
		uploadedFiles,
	});

	const messageToWriteTo = conv.messages.find((message) => message.id === messageToWriteToId);
	if (!messageToWriteTo) {
		error(500, "Failed to create message");
	}
	if (messagesForPrompt.length === 0) {
		error(500, "Failed to create prompt");
	}

	// Stamp the answer's open-web provenance onto the assistant message so the
	// citations strip + map highlight survive reload. Shape owned by searchProvenance
	// (shared with the client's optimistic stamp in +page.svelte) so the two can't drift.
	const webSearchProvenance = searchProvenance(searchContext);
	if (webSearchProvenance) {
		messageToWriteTo.webSearch = webSearchProvenance;
	}

	// W2 idempotency: claim this turn by its client-minted generationId BEFORE persisting the new
	// messages, so a duplicate POST — a network auto-retry of the SAME logical turn (W3) — cannot create
	// a second turn. claimGeneration is atomic: a fresh (or previously-errored) id is claimed and we
	// proceed; a complete/in-flight id loses the claim → return 409 with the existing turn's status so the
	// client attaches to the running stream (or refreshes a finished turn) instead of double-submitting.
	// Only guards when the client sent a generationId (always, for v4-minted runs); legacy callers without
	// one keep prior behavior. A user-initiated regenerate mints a NEW id, so it isn't deduped against this.
	if (generationId) {
		const claimed = await claimGeneration(generationId, convId.toString(), messageToWriteTo.id);
		if (!claimed) {
			const existing = await readGeneration(generationId);
			// NB: `json` from @sveltejs/kit is shadowed by a local `json` (the parsed form field) in this
			// scope, so build the 409 Response directly.
			return new Response(
				JSON.stringify({
					status: existing?.status ?? "in_flight",
					conversationId: convId.toString(),
					messageId: existing?.messageId ?? messageToWriteTo.id,
				}),
				{ status: 409, headers: { "content-type": "application/json" } }
			);
		}
	}

	// update the conversation with the new messages
	await collections.conversations.updateOne(
		{ _id: convId },
		{ $set: { messages: conv.messages, title: conv.title, updatedAt: new Date() } }
	);

	let doneStreaming = false;
	let clientDetached = false;

	const metricsEnabled = MetricsServer.isEnabled();
	const metrics = metricsEnabled ? MetricsServer.getMetrics() : undefined;
	const metricsModelId = model.id ?? model.name ?? conv.model;
	const metricsLabels = { model: metricsModelId };

	const persistConversation = async () => {
		const messagesForSave = conv.messages.map((msg) => {
			const filteredUpdates =
				msg.updates
					?.filter(
						(u) =>
							!(u.type === MessageUpdateType.Status && u.status === MessageUpdateStatus.KeepAlive)
					)
					.map((u) => {
						if (u.type !== MessageUpdateType.Stream) return u;
						// Preserve existing len if already compressed, otherwise compute from token
						const len = u.len ?? (u.token ?? "").length;
						// store a lightweight marker to preserve ordering without duplicating content
						return { type: MessageUpdateType.Stream, token: "", len } satisfies MessageStreamUpdate;
					}) ?? [];

			return { ...msg, updates: filteredUpdates };
		});

		// Best-effort: a transient DB failure at persist time must NOT throw out of the stream's
		// start()/finally (which would error the stream AFTER a good answer already reached the client,
		// and lose the turn on reload). Log and move on — the answer stays visible in-session; the
		// generation idempotency record (finishGeneration below) is the durable retry seam.
		try {
			await collections.conversations.updateOne(
				{ _id: convId },
				{ $set: { messages: messagesForSave, title: conv.title, updatedAt: new Date() } }
			);
		} catch (err) {
			logger.error(
				err,
				"[persist] failed to save conversation (answer shown in-session, not persisted)"
			);
		}
	};

	const abortRegistry = AbortRegistry.getInstance();

	// we now build the stream
	const stream = new ReadableStream({
		async start(controller) {
			const conversationKey = convId.toString();
			const ctrl = new AbortController();
			abortRegistry.register(conversationKey, ctrl);

			// Cross-pod and pre-first-token abort path. The in-process registry
			// only works when the stop request lands on this pod, and the cached
			// AbortedGenerations map is only consulted between tokens — useless
			// while awaiting the first token of a slow (e.g. reasoning) model.
			// Poll the marker collection directly and abort the upstream request
			// as soon as a stop is observed. Pre-flight deleted any stale marker,
			// so marker presence means a stop for this generation.
			const abortMarkerWatcher = setInterval(() => {
				collections.abortedGenerations
					.findOne({ conversationId: convId })
					.then((marker) => {
						if (marker && !ctrl.signal.aborted) {
							logger.info(
								{ conversationId: conversationKey },
								"Stop marker observed; aborting generation"
							);
							ctrl.abort();
						}
						if (marker || ctrl.signal.aborted) {
							clearInterval(abortMarkerWatcher);
						}
					})
					.catch(() => {
						// transient DB error; the next tick retries
					});
			}, 300);

			const state = createStreamState();
			let abortedByUser = false;
			let hasError = false;

			messageToWriteTo.updates ??= [];
			const initialMessageContent = messageToWriteTo.content;
			const metricsCtx =
				metricsEnabled && metrics
					? { model: metrics.model, labels: metricsLabels, promptedAt }
					: undefined;

			// Capture the non-null narrowing here, at the start() body level where it still holds. The
			// nested update() closure below loses it (a known TS limitation across nested functions —
			// the original code used an in-function throw guard for the same reason).
			const message = messageToWriteTo;
			const conversation = conv;
			const activeModel = model;

			// Thin wrapper around the event reducer: fold the event into the assistant message (see
			// $lib/server/chat/streamUpdate — that's where the per-type dispatch and metrics live), then
			// do the client-facing stream plumbing the reducer is deliberately kept out of: enqueue,
			// detach detection, and detached-persist. A null result means "drop this event entirely".
			async function update(event: MessageUpdate) {
				const outgoing = await applyMessageUpdate(event, {
					message,
					initialMessageContent,
					model: activeModel,
					state,
					metrics: metricsCtx,
					saveTitle: async (sanitizedTitle) => {
						conversation.title = sanitizedTitle;
						await collections.conversations.updateOne(
							{ _id: convId },
							{ $set: { title: conversation.title, updatedAt: new Date() } }
						);
					},
				});

				if (outgoing === null) return;

				if (!clientDetached) {
					try {
						controller.enqueue(JSON.stringify(outgoing) + "\n");
						if (outgoing.type === MessageUpdateType.FinalAnswer) {
							controller.enqueue(" ".repeat(4096));
						}
					} catch (err) {
						clientDetached = true;
						logger.info(
							{ conversationId: convId.toString() },
							"Client detached during message streaming"
						);
					}
				}

				if (clientDetached) {
					await persistConversation();
				}
			}

			// Emit the streamed-so-far text as an interrupted final answer. The
			// stopping client freezes its UI at the Stop click and reports its
			// stop point on the abort marker, while tokens keep arriving here
			// until the marker is observed (longer still when the stop request
			// was delayed or retried). Clamp the text back to the stop point so
			// the message persists exactly as the user last saw it instead of
			// "growing back" on the next sync.
			const emitInterruptedFinalAnswer = async () => {
				const marker = await collections.abortedGenerations
					.findOne({ conversationId: convId })
					.catch(() => null);
				messageToWriteTo.content = clampStoppedContent({
					content: messageToWriteTo.content,
					initialLength: initialMessageContent.length,
					generationId,
					marker,
				});
				await update({
					type: MessageUpdateType.FinalAnswer,
					text: messageToWriteTo.content.slice(initialMessageContent.length),
					interrupted: true,
				});
			};

			try {
				// ── Proactive safety pre-screen — runs BEFORE the model ────────────────
				// Mirrors prod (chat/app/(chat)/api/chat/route.ts): screen the user's text first.
				// Child-safety fails CLOSED, toxicity (toxic-bert) fails OPEN. On a flag we stamp the
				// message, stream the decline as the answer, and SKIP the model entirely. The Safety
				// update makes the client render a safety decline (no Apertus badge) and the map flash
				// the toxic-bert node — which is what makes that node's "screens every message before it
				// reaches the model" claim actually true. Re-screens on retry: a toxic prompt must not
				// generate on a second attempt either.
				const userTextToScreen =
					[...messagesForPrompt].reverse().find((m) => m.from === "user")?.content ?? "";
				const childSafety = await checkChildSafety(userTextToScreen);
				const moderation = childSafety.flagged
					? { flagged: true, label: "child_safety" as string | null, score: 1 }
					: await moderateMessage(userTextToScreen);

				if (moderation.flagged) {
					const isChild = childSafety.flagged;
					messageToWriteTo.moderation = moderationMarker({
						label: moderation.label,
						score: moderation.score,
						kind: isChild ? "child_safety" : "toxicity",
					});
					await update({
						type: MessageUpdateType.Safety,
						kind: isChild ? "child_safety" : "toxicity",
						label: moderation.label,
						score: moderation.score,
					});
					await update({
						type: MessageUpdateType.FinalAnswer,
						text: isChild ? CHILD_SAFETY_DECLINE : MODERATION_DECLINE,
						interrupted: false,
					});
					await update({
						type: MessageUpdateType.Status,
						status: MessageUpdateStatus.Finished,
					});
				} else {
					// Fetch user settings once for all overrides and billing org
					const userSettings = await collections.settings.findOne(authCondition(locals));

					// Add billing organization to locals for the endpoint to use
					locals.billingOrganization = userSettings?.billingOrganization;

					const ctx: TextGenerationContext = {
						model,
						endpoint: await model.getEndpoint(),
						conv,
						messages: messagesForPrompt,
						promptedAt,
						ip: getClientAddress(),
						username: locals.user?.username,
						// Force-enable multimodal/tools if user settings say so for this model.
						// On HuggingChat capability comes from the upstream router, so any stored
						// per-user overrides are ignored — existing entries don't keep applying.
						forceMultimodal:
							!config.isHuggingChat && Boolean(userSettings?.multimodalOverrides?.[model.id]),
						// Inference provider preference (HuggingChat only, skip for router models)
						provider:
							config.isHuggingChat && !model.isRouter
								? userSettings?.providerOverrides?.[model.id]
								: undefined,
						// Thinking-effort override (only forwarded for reasoning-capable models;
						// per-user override can force-enable on self-hosted)
						reasoningEffort:
							(userSettings?.reasoningOverrides?.[model.id] ?? model.supportsReasoning)
								? userSettings?.reasoningEffortOverrides?.[model.id]
								: undefined,
						// Artifacts aren't provider-determined, so the per-model user
						// override applies on HuggingChat too
						artifactsOverride: userSettings?.artifactsOverrides?.[model.id],
						// Open-web grounding for this turn (evidence + date only; the model
						// cites the numbered sources). Persistence of the sources happens on
						// messageToWriteTo.webSearch above.
						searchContext: searchContext?.sources.length
							? { evidence: searchContext.evidence, asOf: searchContext.asOf }
							: undefined,
						locals,
						abortController: ctrl,
					};
					// run the text generation and send updates to the client
					for await (const event of textGeneration(ctx)) await update(event);
					if (ctrl.signal.aborted) {
						abortedByUser = true;
					}
					if (abortedByUser && !state.finalAnswerReceived) {
						await emitInterruptedFinalAnswer();
					}
				} // end else: message was not declined by the safety pre-screen
			} catch (e) {
				const err = e as Error;
				const isAbortError =
					err?.name === "AbortError" ||
					err?.name === "APIUserAbortError" ||
					// The OpenAI SDK's APIUserAbortError keeps name "Error", so
					// match the class name too
					err?.constructor?.name === "APIUserAbortError" ||
					err?.message === "Request was aborted.";
				if (isAbortError || ctrl.signal.aborted) {
					abortedByUser = true;
					logger.info({ conversationId: conversationKey }, "Generation aborted by user");
					if (!state.finalAnswerReceived) {
						await emitInterruptedFinalAnswer();
					}
				} else {
					hasError = true;
					// Extract status code if available from HTTPError or APIError
					const errObj = err as unknown as Record<string, unknown>;
					const statusCode =
						(typeof errObj.statusCode === "number" ? errObj.statusCode : undefined) ||
						(typeof errObj.status === "number" ? errObj.status : undefined);
					await update({
						type: MessageUpdateType.Status,
						status: MessageUpdateStatus.Error,
						message: err.message,
						...(statusCode && { statusCode }),
					});
					logger.error(err, "Error in conversation stream");
				}
			} finally {
				// check if no output was generated
				if (!hasError && !abortedByUser && messageToWriteTo.content === initialMessageContent) {
					hasError = true;
					logger.warn(
						{
							conversationId: conversationKey,
							updatesCount: messageToWriteTo.updates?.length ?? 0,
							filesCount: messageToWriteTo.files?.length ?? 0,
							reasoningLen: messageToWriteTo.reasoning?.length ?? 0,
							initialLen: initialMessageContent.length,
							finalLen: messageToWriteTo.content.length,
						},
						"No output generated after streaming; emitting error status"
					);
					await update({
						type: MessageUpdateType.Status,
						status: MessageUpdateStatus.Error,
						message: "No output was generated. Something went wrong.",
					});
				}
			}

			if (!hasError && !state.finishedStatusSent) {
				await update({
					type: MessageUpdateType.Status,
					status: MessageUpdateStatus.Finished,
				});
			}

			await persistConversation();
			// W2: mark this generation terminal. 'complete' covers a user-interrupted turn too (a final
			// answer was persisted); 'error' leaves the id re-claimable by a fresh retry of the same turn
			// (claimGeneration's WHERE status='error'). Best-effort: a failure here must not break the run.
			if (generationId) {
				await finishGeneration(generationId, hasError ? "error" : "complete").catch((err) =>
					logger.warn(err, "Failed to finalize generation idempotency record")
				);
			}
			clearInterval(abortMarkerWatcher);
			abortRegistry.unregister(conversationKey, ctrl);

			// Consume the stop marker once the stop has been honored and the
			// interrupted state persisted. Markers are conversation-scoped, so a
			// leftover would trip the watcher of the next generation; consuming
			// here (instead of unconditionally deleting in pre-flight) keeps
			// markers alive long enough for concurrent in-flight generations to
			// observe them.
			if (abortedByUser) {
				await collections.abortedGenerations
					.deleteOne({ conversationId: convId })
					.catch((err) => logger.warn(err, "Failed to consume stop marker"));
			}

			// used to detect if cancel() is called bc of interrupt or just because the connection closes
			doneStreaming = true;
			if (!clientDetached) {
				controller.close();
			}
		},
		async cancel() {
			if (doneStreaming) return;
			clientDetached = true;
			await persistConversation();
		},
	});

	if (metricsEnabled && metrics) {
		metrics.model.messagesTotal.inc(metricsLabels);
	}

	// Todo: maybe we should wait for the message to be saved before ending the response - in case of errors
	return new Response(stream, {
		headers: {
			"Content-Type": "application/jsonl",
		},
	});
}

export async function DELETE({ locals, params }) {
	const convId = new ObjectId(params.id);

	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conv) {
		error(404, "Conversation not found");
	}

	// FK-ordered cascade (reports/files before the conversation) — a bare deleteOne throws once
	// the conversation has a report (NOT NULL FK to conversations.id).
	await deleteConversationsCascade([conv._id.toString()]);

	return new Response();
}

export async function PATCH({ request, locals, params }) {
	const values = z
		.object({
			title: z.string().trim().min(1).max(100).optional(),
			model: validModelIdSchema.optional(),
		})
		.parse(await request.json());

	const convId = new ObjectId(params.id);

	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conv) {
		error(404, "Conversation not found");
	}

	// Only include defined values in the update, with title sanitized
	const updateValues = {
		...(values.title !== undefined && {
			title: values.title.replace(/<\/?think>/gi, "").trim(),
		}),
		...(values.model !== undefined && { model: values.model }),
	};

	await collections.conversations.updateOne(
		{
			_id: convId,
		},
		{
			$set: updateValues,
		}
	);

	return new Response();
}
