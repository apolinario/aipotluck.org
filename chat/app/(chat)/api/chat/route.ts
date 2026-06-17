import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { hardenLastUserTurn } from "@/lib/ai/grounding";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import {
  CHILD_SAFETY_DECLINE,
  checkChildSafety,
  MODERATION_DECLINE,
  moderateMessage,
} from "@/lib/ai/moderation";
import {
  type RequestHints,
  searchGroundingPrompt,
  systemPrompt,
} from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";
import { checkGlobalRateLimit, checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      searchContext,
    } = requestBody;

    const [botVerdict, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    // Staged bot protection: BotID classifies but we do NOT block yet — log
    // detections to build signal before enabling enforcement, so a false
    // positive can't silently block a real user during the alpha. Flip to a
    // 403 here once the logs show clean classification. (Was previously a
    // no-op: the verdict was computed and discarded.)
    if (botVerdict?.isBot && !botVerdict.isVerifiedBot) {
      console.warn("[botid] bot-classified request allowed (log-only mode)");
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    // Limiters run cheapest-and-broadest first: global capacity breaker (one
    // Redis read, rejects everyone when over the daily budget) before the
    // per-IP backstop, before the per-user DB message-count check below.
    await checkGlobalRateLimit();
    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;

    const modelMessages = await convertToModelMessages(uiMessages);
    // Map-ground + harden the last user turn (ported from gap-chat): injects
    // the matched category's neutralized rationale + real exemplar names
    // (anti-confabulation), and wraps the user's text in a fence carrying the
    // brevity + identity-lock + prompt-injection guard — in the USER role,
    // where Apertus actually honors it (it under-weights the system role).
    hardenLastUserTurn(modelMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        // Proactive moderation (toxic-bert, Apache-2.0) — screen the user's
        // message BEFORE it reaches the model. A flag short-circuits to an
        // honest decline (never the model), and emits a REAL safety event the
        // map mirrors (data-safety → flashes the toxic-bert node). Fails open.
        const userText =
          message?.parts
            ?.filter((p) => p.type === "text")
            .map((p) => p.text)
            .join(" ")
            .trim() ?? "";
        // Child-safety screening runs first and is a hard stop — a separate
        // seam from toxicity, with no detector wired yet (see moderation.ts).
        // Inert today; when a detector is wired it fails CLOSED. Distinct copy,
        // no "rephrase" invitation.
        const childSafety = await checkChildSafety(userText);
        if (childSafety.flagged) {
          const declineId = generateUUID();
          dataStream.write({ type: "text-start", id: declineId });
          dataStream.write({
            type: "text-delta",
            id: declineId,
            delta: CHILD_SAFETY_DECLINE,
          });
          dataStream.write({ type: "text-end", id: declineId });
          return;
        }

        const moderation = await moderateMessage(userText);
        if (moderation.flagged) {
          dataStream.write({
            type: "data-safety",
            data: {
              node: "toxicbert",
              label: moderation.label,
              score: moderation.score,
            },
          });
          const declineId = generateUUID();
          dataStream.write({ type: "text-start", id: declineId });
          dataStream.write({
            type: "text-delta",
            id: declineId,
            delta: MODERATION_DECLINE,
          });
          dataStream.write({ type: "text-end", id: declineId });
          return;
        }

        // If the user accepted an open-web search, surface the numbered sources
        // to the client (rendered as citations, persisted with the message) and
        // ground the model on them. Written first so it lands above the answer.
        if (searchContext && searchContext.sources.length > 0) {
          dataStream.write({
            type: "data-sources",
            data: {
              sources: searchContext.sources,
              asOf: searchContext.asOf,
              query: searchContext.query,
            },
          });
        }

        // Tools (artifacts + weather) are DISABLED for the alpha demonstrator.
        // With Apertus they leak tool names into the reply ("use the
        // createDocument function") and trigger unprompted "would you like me
        // to create a document?" follow-ups — both break the machine-not-a-
        // person voice (caught in the demo playthrough). Web search is
        // app-orchestrated (not a model tool), so the chat needs no model tools
        // today. Re-enable behind a tool-capable model + voice guards before
        // adding agentic features. (Memory: tools-disabled-for-alpha.) When
        // re-enabling, gate on the served model's real capability
        // (`capabilities?.tools === true`), not this constant.
        const toolsEnabled = false;

        const result = streamText({
          model: getLanguageModel(chatModel),
          system: systemPrompt({
            requestHints,
            supportsTools: toolsEnabled,
            searchGrounding: searchContext?.evidence
              ? searchGroundingPrompt(
                  searchContext.evidence,
                  searchContext.asOf
                )
              : undefined,
          }),
          messages: modelMessages,
          // Decoding params ported from the original gap-chat (app/api/chat.js),
          // which produced far more controlled answers than the fork's defaults.
          // Apertus at its default (high) temperature rambles into long
          // enumerated lists; near-greedy decoding + repetition penalties keep
          // it concise and faithful to grounding. Penalties break the
          // repetition loop near-greedy decoding causes on open-ended prompts.
          temperature: 0.1,
          frequencyPenalty: 0.4,
          presencePenalty: 0.3,
          // Tight output ceiling (also the per-request cost cap, see lib/limits)
          // structurally caps verbosity — the 2048 default actively permitted
          // the long answers.
          maxOutputTokens: LIMITS.maxOutputTokens,
          stopWhen: stepCountIs(5),
          experimental_activeTools: toolsEnabled
            ? [
                "getWeather",
                "createDocument",
                "editDocument",
                "updateDocument",
                "requestSuggestions",
              ]
            : [],
          providerOptions: {
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          },
          tools: toolsEnabled
            ? {
                getWeather,
                createDocument: createDocument({
                  session,
                  dataStream,
                  modelId: chatModel,
                }),
                editDocument: editDocument({ dataStream, session }),
                updateDocument: updateDocument({
                  session,
                  dataStream,
                  modelId: chatModel,
                }),
                requestSuggestions: requestSuggestions({
                  session,
                  dataStream,
                  modelId: chatModel,
                }),
              }
            : {},
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel })
        );

        // Surface the REAL inference provider (HF router's x-inference-provider
        // header) so the provenance badge shows where the answer actually ran,
        // instead of a hardcoded compute guess. Best-effort; never blocks.
        result.response.then(
          (r) => {
            const provider = r.headers?.["x-inference-provider"];
            if (provider) {
              dataStream.write({ type: "data-provider", data: { provider } });
            }
          },
          () => {
            /* header unavailable — badge falls back to the model default */
          }
        );

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          } catch (_) {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: () => "Oops, an error occurred!",
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
