"use client";

import { MODEL } from "@/lib/ai/model-identity";
import { ContributeDialog } from "./contribute-dialog";

// The first-run orientation screen the Feature Lock calls the highest-priority
// new item for July 9: a non-technical attendee arriving cold via the summit QR
// code needs to know what AI Potluck is, who built it, and why it differs from
// ChatGPT before the chat reads as "just another chatbot". Per Web UX wireframe
// W1 it overlays the CHAT PANEL only — on desktop the live stack map stays
// visible on the right, so the copy and the map reinforce each other.
//
// Voice: flat, declarative, non-anthropomorphic, honest about the alpha (gaps
// are framed as open invitations, not hidden). Final visual design is Laura's.

export function WelcomeOverlay({
  onStartChatting,
  onSeeHowBuilt,
  onSkip,
}: {
  onStartChatting: () => void;
  onSeeHowBuilt: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      aria-label="Welcome to AI Potluck"
      aria-modal="true"
      className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-[var(--paper,#faf8f3)]/95 backdrop-blur-sm"
      role="dialog"
    >
      <button
        aria-label="Skip the introduction"
        className="absolute top-3 right-3 z-10 font-mono text-[10px] text-[var(--ap-ink-3)] uppercase tracking-[0.1em] transition-colors hover:text-[var(--ap-ink)]"
        onClick={onSkip}
        type="button"
      >
        Skip →
      </button>

      <div className="mx-auto flex min-h-full max-w-prose flex-col justify-center gap-4 px-6 py-12">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: "var(--ap-live)" }}
          />
          <span className="font-mono text-[10px] text-[var(--ap-ink-3)] uppercase tracking-[0.12em]">
            A public AI · alpha
          </span>
        </div>

        <h1 className="font-serif text-[28px] text-[var(--ap-ink)] leading-tight md:text-[34px]">
          A working AI, assembled in the open — and showing its work.
        </h1>

        <p className="text-[14px] text-[var(--ap-ink)]/85 leading-relaxed">
          AI Potluck is not a product and not a research demo. It is a public
          utility: a usable assistant built entirely from open-source parts, run
          on compute owned by the public rather than a company.
        </p>

        <p className="text-[14px] text-[var(--ap-ink)]/85 leading-relaxed">
          Answers come from {MODEL.short}, the open model from the Swiss
          National AI Initiative. This prototype is served via HuggingFace for
          speed; the production stack runs on sovereign public compute at CSCS
          (Switzerland) and LUMI (Finland). Open partners cover safety, search,
          and more.
        </p>

        <p className="text-[14px] text-[var(--ap-ink)]/85 leading-relaxed">
          What makes it different from a closed assistant: every answer shows
          its work — which model wrote it, whose compute ran it, and which parts
          of the stack are still missing. Nothing hides behind a black box. The
          map <span className="hidden md:inline">on the right</span>
          <span className="md:hidden">under “Under the hood”</span> is that
          stack, live. Gaps are shown as open invitations, not swept away.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <button
            className="rounded-full bg-[var(--ap-ink)] px-4 py-2 font-mono text-[11px] text-[var(--paper,#faf8f3)] uppercase tracking-[0.08em] transition-opacity hover:opacity-85"
            onClick={onStartChatting}
            type="button"
          >
            Start chatting
          </button>
          <button
            className="rounded-full border border-[var(--ap-rule)] px-4 py-2 font-mono text-[11px] text-[var(--ap-ink)] uppercase tracking-[0.08em] transition-colors hover:bg-[var(--ap-ink)]/5"
            onClick={onSeeHowBuilt}
            type="button"
          >
            See how it's built
          </button>
          <ContributeDialog />
        </div>
      </div>
    </div>
  );
}
