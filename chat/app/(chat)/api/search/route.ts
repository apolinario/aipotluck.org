import { auth } from "@/app/(auth)/auth";
import { openSearch } from "@/lib/search/open-search";

// Open-knowledge search endpoint: the client calls this when the user accepts
// the "search open sources?" affordance (or hits the manual button). Returns
// numbered sources + an evidence block the chat turn is then grounded on.
// Open sources only (Wikipedia + Marginalia) — see lib/search/open-search.ts.

export const maxDuration = 20;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return Response.json({ error: "missing query" }, { status: 400 });
  }
  if (q.length > 400) {
    return Response.json({ error: "query too long" }, { status: 400 });
  }

  try {
    const result = await openSearch(q, { timeoutMs: 9000 });
    return Response.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ error: "search failed" }, { status: 502 });
  }
}
