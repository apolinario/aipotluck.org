"use client";

import { useEffect, useRef, useState } from "react";
import { StackMap } from "@/components/stack/stack-map";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatHeader } from "./chat-header";
import { DataStreamHandler } from "./data-stream-handler";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { WelcomeOverlay } from "./welcome-overlay";

export function ChatShell() {
  const {
    chatId,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    input,
    setInput,
    visibilityType,
    isReadonly,
    isLoading,
    votes,
    currentModelId,
    setCurrentModelId,
  } = useActiveChat();

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact } = useArtifact();

  // Mobile only (below md): the split-screen collapses to a single column with
  // a chat/map tab switcher — on a phone the map is "one tap away" rather than
  // hidden. The dot flags unseen map activity (a turn streamed, or a "show on
  // map" flash fired) while the user is on the chat tab. Desktop ignores all of
  // this: both panels render side by side and the tab bar is md:hidden.
  const [mobileTab, setMobileTab] = useState<"chat" | "map">("chat");
  const [mapHasActivity, setMapHasActivity] = useState(false);
  const mobileTabRef = useRef(mobileTab);
  mobileTabRef.current = mobileTab;

  const turnActive = status === "streaming" || status === "submitted";
  useEffect(() => {
    if (turnActive && mobileTabRef.current === "chat") {
      setMapHasActivity(true);
    }
  }, [turnActive]);

  useEffect(() => {
    const onFlash = () => {
      if (mobileTabRef.current === "chat") {
        setMapHasActivity(true);
      }
    };
    window.addEventListener("ap:flash", onFlash);
    return () => window.removeEventListener("ap:flash", onFlash);
  }, []);

  const showMap = () => {
    setMobileTab("map");
    setMapHasActivity(false);
  };

  // The greeting's "See how it's built" CTA (and any other surface) can ask to
  // reveal the map; on mobile that means switching to the map tab. setState
  // dispatchers are stable, so the empty dep array is correct.
  useEffect(() => {
    const onShowMap = () => {
      setMobileTab("map");
      setMapHasActivity(false);
    };
    window.addEventListener("ap:show-map", onShowMap);
    return () => window.removeEventListener("ap:show-map", onShowMap);
  }, []);

  // First-run orientation overlay (Feature Lock's top July-9 item). Shown once
  // per browser on a fresh chat; gated in an effect (not lazy init) so the
  // server never renders it — localStorage is client-only, and this avoids a
  // hydration mismatch. Returning visitors / loaded histories don't see it.
  const [showWelcome, setShowWelcome] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: first-mount gate only
  useEffect(() => {
    try {
      if (!localStorage.getItem("ap:onboarded") && messages.length === 0) {
        setShowWelcome(true);
      }
    } catch {
      /* storage blocked — just skip the overlay */
    }
  }, []);

  const dismissWelcome = () => {
    setShowWelcome(false);
    try {
      localStorage.setItem("ap:onboarded", "1");
    } catch {
      /* ignore */
    }
  };

  const handleWelcomeStart = () => {
    dismissWelcome();
    // Focus after the overlay unmounts so the composer is interactable.
    setTimeout(() => {
      (
        document.querySelector(
          '[data-testid="multimodal-input"]'
        ) as HTMLTextAreaElement | null
      )?.focus();
    }, 0);
  };

  const handleWelcomeSeeBuilt = () => {
    dismissWelcome();
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileTab("map");
      setMapHasActivity(false);
    } else {
      // Defer past the dismiss re-render, or it would wipe the flash class.
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("ap:flash", { detail: { ids: ["apertus", "cscs"] } })
        );
      }, 0);
    }
  };

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
    }
  }, [chatId, setArtifact]);

  return (
    <>
      <div className="flex h-dvh w-full flex-col overflow-hidden md:flex-row">
        <div
          className={cn(
            "min-w-0 flex-col bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            // Desktop: fixed-width left column, always shown.
            isArtifactVisible ? "md:w-[40%]" : "md:w-[46%]",
            "md:flex md:min-h-0 md:flex-none",
            // Mobile: full-bleed, fills the column, shown only on the chat tab.
            mobileTab === "chat" ? "flex min-h-0 w-full flex-1" : "hidden"
          )}
        >
          <ChatHeader
            chatId={chatId}
            isReadonly={isReadonly}
            selectedVisibilityType={visibilityType}
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-tl-[12px] md:border-t md:border-l md:border-border/40">
            {showWelcome && (
              <WelcomeOverlay
                onSeeHowBuilt={handleWelcomeSeeBuilt}
                onSkip={dismissWelcome}
                onStartChatting={handleWelcomeStart}
              />
            )}
            <Messages
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              isArtifactVisible={isArtifactVisible}
              isLoading={isLoading}
              isReadonly={isReadonly}
              messages={messages}
              onEditMessage={(msg) => {
                const text = msg.parts
                  ?.filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("");
                setInput(text ?? "");
                setEditingMessage(msg);
              }}
              regenerate={regenerate}
              selectedModelId={currentModelId}
              setMessages={setMessages}
              status={status}
              votes={votes}
            />

            <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
              {!isReadonly && (
                <MultimodalInput
                  attachments={attachments}
                  chatId={chatId}
                  editingMessage={editingMessage}
                  input={input}
                  isLoading={isLoading}
                  messages={messages}
                  onCancelEdit={() => {
                    setEditingMessage(null);
                    setInput("");
                  }}
                  onModelChange={setCurrentModelId}
                  selectedModelId={currentModelId}
                  selectedVisibilityType={visibilityType}
                  sendMessage={
                    editingMessage
                      ? async () => {
                          const msg = editingMessage;
                          setEditingMessage(null);
                          await submitEditedMessage({
                            message: msg,
                            text: input,
                            setMessages,
                            regenerate,
                          });
                          setInput("");
                        }
                      : sendMessage
                  }
                  setAttachments={setAttachments}
                  setInput={setInput}
                  setMessages={setMessages}
                  status={status}
                  stop={stop}
                />
              )}
            </div>
          </div>
        </div>

        {!isArtifactVisible && (
          <StackMap
            messages={messages}
            mobileActive={mobileTab === "map"}
            status={status}
          />
        )}

        {/* Mobile-only tab switcher. Lives in the column flow so neither panel
            sits under it. Hidden from md up, where both panels are visible. */}
        <nav className="flex shrink-0 items-stretch border-[var(--ap-rule)] border-t bg-sidebar md:hidden">
          <button
            className={cn(
              "flex-1 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors",
              mobileTab === "chat"
                ? "text-[var(--ap-ink)]"
                : "text-[var(--ap-ink-3)]"
            )}
            onClick={() => setMobileTab("chat")}
            type="button"
          >
            Chat
          </button>
          <button
            className={cn(
              "relative flex-1 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors",
              mobileTab === "map"
                ? "text-[var(--ap-ink)]"
                : "text-[var(--ap-ink-3)]"
            )}
            onClick={showMap}
            type="button"
          >
            Under the hood
            {mapHasActivity && mobileTab !== "map" && (
              <span
                aria-hidden
                className="absolute top-2 ml-1.5 size-1.5 rounded-full"
                style={{ background: "var(--ap-live)" }}
              />
            )}
          </button>
        </nav>

        <Artifact
          addToolApprovalResponse={addToolApprovalResponse}
          attachments={attachments}
          chatId={chatId}
          input={input}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          selectedVisibilityType={visibilityType}
          sendMessage={sendMessage}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages}
          status={status}
          stop={stop}
          votes={votes}
        />
      </div>

      <DataStreamHandler />
    </>
  );
}
