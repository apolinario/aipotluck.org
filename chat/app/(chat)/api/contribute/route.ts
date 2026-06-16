import { ipAddress } from "@vercel/functions";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { saveContribution } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { checkContributionRateLimit } from "@/lib/ratelimit";

// Public contribution capture for the "what happens after the chat" paths. No
// auth wall (an attendee may submit straight from the welcome overlay), but we
// attach the guest session's userId if one exists, and rate-limit per IP.
const contributeSchema = z.object({
  kind: z.enum(["subscribe", "contribute"]),
  email: z.string().email().max(256),
  name: z.string().max(200).nullish(),
  organization: z.string().max(200).nullish(),
  contributionType: z
    .enum(["compute", "data", "code", "funding", "other"])
    .nullish(),
  detail: z.string().max(2000).nullish(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof contributeSchema>;

  try {
    body = contributeSchema.parse(await request.json());
  } catch {
    return new ChatbotError(
      "bad_request:api",
      "A valid email and a kind are required."
    ).toResponse();
  }

  try {
    await checkContributionRateLimit(ipAddress(request));

    // Best-effort attribution — never block a submission on the session lookup.
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.user?.id ?? null;
    } catch {
      userId = null;
    }

    await saveContribution({
      kind: body.kind,
      email: body.email,
      name: body.name ?? null,
      organization: body.organization ?? null,
      contributionType: body.contributionType ?? null,
      detail: body.detail ?? null,
      userId,
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError(
      "bad_request:database",
      "Failed to save contribution"
    ).toResponse();
  }

  return new Response("Contribution received", { status: 200 });
}
