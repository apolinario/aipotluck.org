import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { hashIp } from "$lib/server/db/ipHash";
import { config } from "$lib/server/config";
import { models, validModelIdSchema } from "$lib/server/models";
import { ERROR_MESSAGES } from "$lib/stores/errors";
import type { Message } from "$lib/types/Message";
import { SEARCH_ENGINES } from "$lib/types/Search";
import { error } from "@sveltejs/kit";
import { ObjectId } from "bson";
import { z } from "zod";
import {
	MessageUpdateStatus,
	MessageUpdateType,
	MessageReasoningUpdateType,
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
import { isMessageId } from "$lib/utils/tree/isMessageId";
import { buildSubtree } from "$lib/utils/tree/buildSubtree.js";
import { addChildren } from "$lib/utils/tree/addChildren.js";
import { addSibling } from "$lib/utils/tree/addSibling.js";
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

	// Register the event for ratelimiting — best-effort. Rate-limit bookkeeping is infrastructure and
	// must NEVER take down a turn: a DB blip here once 500'd every chat request (the insert threw before
	// the model ran). On failure we log and continue (fail open); the worst case is one un-recorded event,
	// a slight under-count that is acceptable for a soft per-minute limit.
	try {
		await collections.messageEvents.insertOne({
			type: "message",
			userId,
			createdAt: new Date(),
			expiresAt: new Date(Date.now() + 60_000),
			ipHash: hashIp(getClientAddress(), "rate-limit"),
		});
	} catch (e) {
		logger.warn(e, "[rate-limit] failed to record message event — continuing (fail open)");
	}

	if (usageLimits?.messagesPerMinute) {
		// Per-SESSION limit (each guest/user has a unique sessionId) — the fair, NAT-SAFE primary
		// limit: one person can't spam, but classmates sharing a public IP behind a NAT each get their
		// own budget. (Hard-won lesson: a per-IP limit at the per-person rate once locked out a whole
		// NAT'd classroom at once — exactly the education audience this alpha targets.)
		// Fail open on a count error (DB blip) — same posture as the global daily cap below: a limiter
		// failure must not block a turn. Only an actual over-limit count (not a failed count) 429s.
		let perSession: number | null = null;
		try {
			perSession = await collections.messageEvents.countDocuments({
				userId,
				type: "message",
				expiresAt: { $gt: new Date() },
			});
		} catch (e) {
			logger.warn(e, "[rate-limit] per-session count failed — failing open");
		}
		if (perSession !== null && perSession > usageLimits.messagesPerMinute) {
			error(429, ERROR_MESSAGES.rateLimited);
		}
		// Per-IP limiting is OFF by default — a single conference/lecture-hall wifi NAT can put a
		// thousand phones behind ONE IP, so any per-IP cap risks locking out the whole room (the exact
		// failure we're avoiding). Per-session above is the NAT-safe limiter; the global daily cap is
		// the runaway-spend backstop. Enable a LOOSE per-IP anti-abuse ceiling only if a specific
		// single-IP-many-sessions abuse appears, by setting RATE_LIMIT_IP_MULTIPLIER (× messagesPerMinute);
		// keep it generous (it is a runaway ceiling, never the per-person rate).
		const ipMultiplier = Number(Reflect.get(config, "RATE_LIMIT_IP_MULTIPLIER")) || 0;
		// Count against the SAME keyed hash we store on insert (domain "rate-limit"). When no pepper is
		// configured hashIp returns null — we then skip the per-IP ceiling entirely (fail open), rather
		// than count rows where ip_hash IS NULL, which would conflate every unhashed event into one bucket.
		const ipHash = hashIp(getClientAddress(), "rate-limit");
		if (ipMultiplier > 0 && ipHash) {
			let perIp: number | null = null;
			try {
				perIp = await collections.messageEvents.countDocuments({
					ipHash,
					type: "message",
					expiresAt: { $gt: new Date() },
				});
			} catch (e) {
				logger.warn(e, "[rate-limit] per-IP count failed — failing open");
			}
			if (perIp !== null && perIp > usageLimits.messagesPerMinute * ipMultiplier) {
				error(429, ERROR_MESSAGES.rateLimited);
			}
		}
	}

	// Service-wide DAILY request cap — a cost/abuse guardrail for the limited CSCS/HF compute budget,
	// distinct from the per-user/per-IP per-minute limit above. Counts requests in a rolling 24h window
	// via a dedicated "globalDaily" messageEvent (the table + cleanup already GC by expiresAt). The DB
	// count is approximate (the best-fit for serverless — no Redis): a brief overshoot under concurrency
	// or a transient error is acceptable for a soft cap. FAIL-OPEN on a count error so a DB blip can't
	// take the whole service down; logged when hit / on error. Disabled when the env var is unset/0.
	const globalDailyCap = Number(config.GLOBAL_DAILY_REQUEST_CAP) || 0;
	if (globalDailyCap > 0) {
		let dailyCount: number | null = null;
		try {
			dailyCount = await collections.messageEvents.countDocuments({
				type: "globalDaily",
				expiresAt: { $gt: new Date() },
			});
		} catch (e) {
			logger.warn(e, "[rate-limit] global daily cap count failed — failing open");
		}
		if (dailyCount !== null && dailyCount >= globalDailyCap) {
			logger.warn({ dailyCount, globalDailyCap }, "[rate-limit] global daily request cap reached");
			error(429, "The service has reached today's request limit. Please try again later.");
		}
		// Record this request in the 24h window (best-effort — a failed insert just under-counts).
		try {
			await collections.messageEvents.insertOne({
				type: "globalDaily",
				userId,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
				ipHash: hashIp(getClientAddress(), "rate-limit"),
			});
		} catch (e) {
			logger.warn(e, "[rate-limit] global daily event insert failed");
		}
	}

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
	} = z
		.object({
			id: z.string().uuid().refine(isMessageId).optional(), // parent message id to append to for a normal message, or the message id for a retry/continue
			// client-chosen id for this generation run, echoed back by the stop
			// request so a stop point can be matched to the run it belongs to
			generationId: z.string().uuid().optional(),
			inputs: z.optional(
				z
					.string()
					.min(1)
					.transform((s) => s.replace(/\r\n/g, "\n"))
			),
			is_retry: z.optional(z.boolean()),
			selectedMcpServerNames: z.optional(z.array(z.string())),
			selectedMcpServers: z
				.optional(
					z.array(
						z.object({
							name: z.string(),
							url: z.string(),
							headers: z
								.optional(z.array(z.object({ key: z.string(), value: z.string() })))
								.default([]),
						})
					)
				)
				.default([]),
			timezone: z.optional(z.string()),
			// Open-web search grounding the client attached for this turn (composer
			// globe toggle). The client runs /api/search and forwards the result so
			// the citations shown match exactly what grounds the answer. Sizes are
			// capped: this is the user's own turn (no privilege escalation — they
			// could type anything as the prompt anyway), but bound the payload.
			searchContext: z.optional(
				z.object({
					query: z.string().max(400),
					asOf: z.string().max(40),
					evidence: z.string().max(20_000),
					sources: z
						.array(
							z.object({
								n: z.number(),
								title: z.string(),
								url: z.string(),
								snippet: z.string(),
								engine: z.enum(SEARCH_ENGINES),
								asOf: z.string().optional(),
							})
						)
						.max(20),
				})
			),
			files: z.optional(
				z.array(
					z.object({
						type: z.literal("base64").or(z.literal("hash")),
						name: z.string(),
						value: z.string(),
						mime: z.string(),
					})
				)
			),
		})
		.parse(JSON.parse(json));

	// Attach MCP selection to locals so the text generation pipeline can consume it
	try {
		(locals as unknown as Record<string, unknown>).mcp = {
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

	// Attach user timezone so the tool prompt can include localized time
	if (timezone) {
		(locals as unknown as Record<string, unknown>).timezone = timezone;
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

	// check sizes
	// todo: make configurable
	if (b64Files.some((file) => file.size > 10 * 1024 * 1024)) {
		error(413, "File too large, should be <10MB");
	}

	const uploadedFiles = await Promise.all(b64Files.map((file) => uploadFile(file, conv))).then(
		(files) => [...files, ...hashFiles]
	);

	// we will append tokens to the content of this message
	let messageToWriteToId: Message["id"] | undefined = undefined;
	// used for building the prompt, subtree of the conversation that goes from the latest message to the root
	let messagesForPrompt: Message[] = [];

	if (isRetry && messageId) {
		// two cases, if we're retrying a user message with a newPrompt set,
		// it means we're editing a user message
		// if we're retrying on an assistant message, newPrompt cannot be set
		// it means we're retrying the last assistant message for a new answer

		const messageToRetry = conv.messages.find((message) => message.id === messageId);

		if (!messageToRetry) {
			error(404, "Message not found");
		}

		if (messageToRetry.from === "user" && newPrompt) {
			// add a sibling to this message from the user, with the alternative prompt
			// add a children to that sibling, where we can write to
			const newUserMessageId = addSibling(
				conv,
				{
					from: "user",
					content: newPrompt,
					files: uploadedFiles,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				messageId
			);
			messageToWriteToId = addChildren(
				conv,
				{
					from: "assistant",
					content: "",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				newUserMessageId
			);
			messagesForPrompt = buildSubtree(conv, newUserMessageId);
		} else if (messageToRetry.from === "assistant") {
			// we're retrying an assistant message, to generate a new answer
			// just add a sibling to the assistant answer where we can write to
			messageToWriteToId = addSibling(
				conv,
				{ from: "assistant", content: "", createdAt: new Date(), updatedAt: new Date() },
				messageId
			);
			messagesForPrompt = buildSubtree(conv, messageId);
			messagesForPrompt.pop(); // don't need the latest assistant message in the prompt since we're retrying it
		}
	} else {
		// just a normal linear conversation, so we add the user message
		// and the blank assistant message back to back
		const newUserMessageId = addChildren(
			conv,
			{
				from: "user",
				content: newPrompt ?? "",
				files: uploadedFiles,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			messageId
		);

		messageToWriteToId = addChildren(
			conv,
			{
				from: "assistant",
				content: "",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			newUserMessageId
		);
		// build the prompt from the user message
		messagesForPrompt = buildSubtree(conv, newUserMessageId);
	}

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

	let lastTokenTimestamp: undefined | Date = undefined;
	let firstTokenObserved = false;
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

			let finalAnswerReceived = false;
			let abortedByUser = false;
			let finishedStatusSent = false;

			messageToWriteTo.updates ??= [];
			async function update(event: MessageUpdate) {
				if (!messageToWriteTo || !conv) {
					throw Error("No message or conversation to write events to");
				}

				if (
					event.type === MessageUpdateType.Status &&
					event.status === MessageUpdateStatus.Finished
				) {
					finishedStatusSent = true;
				}

				// Add token to content or skip if empty
				if (event.type === MessageUpdateType.Stream) {
					if (event.token === "") return;
					messageToWriteTo.content += event.token;

					if (metricsEnabled && metrics) {
						const now = Date.now();
						metrics.model.tokenCountTotal.inc(metricsLabels);

						if (!firstTokenObserved) {
							metrics.model.timeToFirstToken.observe(metricsLabels, now - promptedAt.getTime());
							firstTokenObserved = true;
						}

						const previousTimestamp = lastTokenTimestamp
							? lastTokenTimestamp.getTime()
							: promptedAt.getTime();
						metrics.model.timePerOutputToken.observe(metricsLabels, now - previousTimestamp);
					}

					lastTokenTimestamp = new Date();
				}

				// Append reasoning stream tokens to message.reasoning (server-side)
				else if (
					event.type === MessageUpdateType.Reasoning &&
					event.subtype === MessageReasoningUpdateType.Stream &&
					"token" in event
				) {
					messageToWriteTo.reasoning ??= "";
					messageToWriteTo.reasoning += event.token;
				}

				// Set the title
				else if (event.type === MessageUpdateType.Title) {
					// Always strip <think> markers from titles when saving
					const sanitizedTitle = event.title.replace(/<\/?think>/gi, "").trim();
					conv.title = sanitizedTitle;
					await collections.conversations.updateOne(
						{ _id: convId },
						{ $set: { title: conv?.title, updatedAt: new Date() } }
					);
				}

				// Set the final text and the interrupted flag
				else if (event.type === MessageUpdateType.FinalAnswer) {
					messageToWriteTo.interrupted = event.interrupted;
					// Default behavior: replace the streamed text with the provider's final text.
					// However, when tools (MCP/function calls) were used, providers often stream
					// some content (e.g., a story) before triggering tools, then return a
					// different follow‑up message afterwards (e.g., an image caption). Our
					// previous logic overwrote the pre‑tool content. Preserve it by merging in
					// the pre‑tool stream when tool updates occurred and the final text does
					// not already include the streamed prefix.
					// Tools/MCP removed (B1-lite strip) — no tool updates are ever produced.
					const hadTools = false;

					if (hadTools) {
						const existing = messageToWriteTo.content.slice(initialMessageContent.length);
						if (existing && existing.length > 0) {
							// A. If we already streamed the same final text, keep as-is.
							if (event.text && existing.endsWith(event.text)) {
								messageToWriteTo.content = initialMessageContent + existing;
							}
							// B. If the final text already includes the streamed prefix, use it verbatim.
							else if (event.text && event.text.startsWith(existing)) {
								messageToWriteTo.content = initialMessageContent + event.text;
							}
							// C. Otherwise, merge with a paragraph break for readability.
							else {
								const needsGap = !/\n\n$/.test(existing) && !/^\n/.test(event.text ?? "");
								messageToWriteTo.content =
									initialMessageContent + existing + (needsGap ? "\n\n" : "") + (event.text ?? "");
							}
						} else {
							messageToWriteTo.content = initialMessageContent + (event.text ?? "");
						}
					} else {
						messageToWriteTo.content = initialMessageContent + event.text;
					}
					finalAnswerReceived = true;

					if (metricsEnabled && metrics) {
						metrics.model.latency.observe(metricsLabels, Date.now() - promptedAt.getTime());
					}
				}

				// Add file
				else if (event.type === MessageUpdateType.File) {
					messageToWriteTo.files = [
						...(messageToWriteTo.files ?? []),
						{ type: "hash", name: event.name, value: event.sha, mime: event.mime },
					];
				}

				// Store router metadata (for router models) or provider info (for all models)
				else if (event.type === MessageUpdateType.RouterMetadata) {
					// Merge metadata updates to preserve existing fields (router may send route/model first, then provider comes later)
					if (model?.isRouter) {
						messageToWriteTo.routerMetadata = {
							route: event.route || messageToWriteTo.routerMetadata?.route || "",
							model: event.model || messageToWriteTo.routerMetadata?.model || "",
							provider: event.provider || messageToWriteTo.routerMetadata?.provider,
						};
					}
					// Store provider-only metadata for non-router models if available
					else if (event.provider) {
						messageToWriteTo.routerMetadata = {
							route: messageToWriteTo.routerMetadata?.route || "",
							model: messageToWriteTo.routerMetadata?.model || "",
							provider: event.provider,
						};
					}
				}

				// Append updates for audit/replay (streams too, to preserve ordering). AgentStep is a
				// transient live-stack animation beat (the step history persists in the <think> block and
				// the verified answer), so it streams to the client but is NOT written to the audit log.
				if (
					!(
						event.type === MessageUpdateType.Status &&
						event.status === MessageUpdateStatus.KeepAlive
					) &&
					event.type !== MessageUpdateType.AgentStep
				) {
					messageToWriteTo?.updates?.push(
						event.type === MessageUpdateType.Stream ? { ...event } : event
					);
				}

				// Avoid remote keylogging attack executed by watching packet lengths
				// by padding the text with null chars to a fixed length
				// https://cdn.arstechnica.net/wp-content/uploads/2024/03/LLM-Side-Channel.pdf
				if (event.type === MessageUpdateType.Stream) {
					event = { ...event, token: event.token.padEnd(16, "\0") };
				}

				messageToWriteTo.updatedAt = new Date();

				const enqueueUpdate = async () => {
					if (clientDetached) return;
					try {
						controller.enqueue(JSON.stringify(event) + "\n");
						if (event.type === MessageUpdateType.FinalAnswer) {
							controller.enqueue(" ".repeat(4096));
						}
					} catch (err) {
						clientDetached = true;
						logger.info(
							{ conversationId: convId.toString() },
							"Client detached during message streaming"
						);
					}
				};

				await enqueueUpdate();

				if (clientDetached) {
					await persistConversation();
				}
			}

			let hasError = false;
			const initialMessageContent = messageToWriteTo.content;

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
					if (abortedByUser && !finalAnswerReceived) {
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
					if (!finalAnswerReceived) {
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

			if (!hasError && !finishedStatusSent) {
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
