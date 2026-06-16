import { deleteOldGuestChats } from "@/lib/db/queries";

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS) || 30;

// Retention sweep, invoked by a Vercel Cron (see vercel.json). Vercel adds
// `Authorization: Bearer <CRON_SECRET>` to cron requests when CRON_SECRET is
// set; we require it and fail closed, so this purge endpoint is never publicly
// callable. Deletes guest chats older than RETENTION_DAYS.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await deleteOldGuestChats({ days: RETENTION_DAYS });

  console.log(
    `[retention] swept ${result.deletedCount} guest chats older than ${RETENTION_DAYS}d (cutoff ${result.cutoff.toISOString()})`
  );

  return Response.json({
    ok: true,
    deletedCount: result.deletedCount,
    retentionDays: RETENTION_DAYS,
    cutoff: result.cutoff.toISOString(),
  });
}
