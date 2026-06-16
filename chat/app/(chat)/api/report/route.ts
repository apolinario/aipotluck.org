import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getChatById, saveReport } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const reportSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid().nullish(),
  reason: z.enum(["harmful", "inaccurate", "privacy", "other"]),
  detail: z.string().max(2000).nullish(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof reportSchema>;

  try {
    body = reportSchema.parse(await request.json());
  } catch {
    return new ChatbotError(
      "bad_request:api",
      "Parameters chatId and reason are required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id: body.chatId });

  if (!chat) {
    return new ChatbotError("not_found:chat").toResponse();
  }

  // Reports are scoped to the reporter's own conversation — prevents reporting
  // (and spamming reports against) other users' chats.
  if (chat.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  await saveReport({
    chatId: body.chatId,
    messageId: body.messageId ?? null,
    userId: session.user.id,
    reason: body.reason,
    detail: body.detail ?? null,
  });

  return new Response("Report received", { status: 200 });
}
