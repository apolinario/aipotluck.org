import type { UseChatHelpers } from "@ai-sdk/react";
import { toast } from "sonner";
import type { OpenSearchResult } from "@/lib/search/open-search";
import type { ChatMessage } from "@/lib/types";

type SendMessage = UseChatHelpers<ChatMessage>["sendMessage"];

// Single open-web-search path, shared by the composer's globe button and the
// recency starter prompts so both behave identically: hit /api/search (Wikipedia
// + Marginalia), flash the Web-search node in the live stack, then send the turn
// grounded on the numbered sources (so the answer cites [n]). On any failure the
// turn still sends — just answered from training, never silently dropped.
//
// Client-only (uses window + sonner); call from event handlers, not on the server.
export async function runOpenSearch({
  query,
  parts,
  sendMessage,
  chatId,
}: {
  query: string;
  parts: ChatMessage["parts"];
  sendMessage: SendMessage;
  chatId: string;
}): Promise<void> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  window.dispatchEvent(
    new CustomEvent("ap:flash", { detail: { ids: ["websearch"] } })
  );
  window.history.pushState({}, "", `${basePath}/chat/${chatId}`);

  try {
    const res = await fetch(
      `${basePath}/api/search?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) {
      throw new Error("search failed");
    }
    const ctx = (await res.json()) as OpenSearchResult;
    if (ctx.sources?.length) {
      sendMessage({ role: "user", parts }, { body: { searchContext: ctx } });
    } else {
      toast("No open sources found — answering from training.");
      sendMessage({ role: "user", parts });
    }
  } catch {
    toast.error("Search failed — answering from training instead.");
    sendMessage({ role: "user", parts });
  }
}
