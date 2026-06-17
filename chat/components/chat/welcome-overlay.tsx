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
            A Current AI · Alpha
          </span>
        </div>

        <h1 className="font-serif text-[28px] text-[var(--ap-ink)] leading-tight md:text-[34px]">
          A model for collective abundance.
        </h1>

        <p className="text-[14px] text-[var(--ap-ink)]/85 leading-relaxed">
          AI Potluck is not a product. It is methodology for bringing together
          the best that exists in open-source AI, in service of the public
          interest.
        </p>

        <p className="text-[14px] text-[var(--ap-ink)]/85 leading-relaxed">
          Our intelligence comes from {MODEL.short}, the open model from the
          Swiss National AI Initiative. This prototype is served via HuggingFace
          Inference and the Public AI Inference Utility; the production stack is
          being built on sovereign public compute at CSCS (Switzerland) and LUMI
          (Finland). ROOST covers safety while OpenMined helps ensure
          responsible use of data. The Mozilla Data Collective rounds out our
          stack with locally-sourced data sets.
        </p>

        <p className="text-[14px] text-[var(--ap-ink)]/85 leading-relaxed">
          This website is a demonstration of what we can do together. But it's
          also a demonstration of all the gaps in open source, and where we need
          to focus if we're going to catch up with the big closed AI labs. Our
          little chatbot, like much of open source, is also a work-in-progress.
          That's okay. We think of every gap as an open invitation. Come join
          the Potluck.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <button
            className="rounded-full bg-[var(--ap-ink)] px-4 py-2 font-mono text-[11px] text-[var(--paper,#faf8f3)] uppercase tracking-[0.08em] transition-opacity hover:opacity-85"
            onClick={onStartChatting}
            type="button"
          >
            Start chatting
          </button>
          {/* "See the ecosystem" = the broader gap map (the Explorer at the site
              root, OUTSIDE this chat's /chat basePath). A plain <a> (not next/link)
              so the basePath isn't prepended, opened in a new tab so the visitor
              isn't pulled out of onboarding — the chat stays put behind it.
              URL is env-overridable; defaults to the Explorer. */}
          <a
            className="rounded-full border border-[var(--ap-rule)] px-4 py-2 font-mono text-[11px] text-[var(--ap-ink)] uppercase tracking-[0.08em] transition-colors hover:bg-[var(--ap-ink)]/5"
            href={process.env.NEXT_PUBLIC_ECOSYSTEM_URL ?? "/app"}
            rel="noopener noreferrer"
            target="_blank"
          >
            See the ecosystem
          </a>
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
