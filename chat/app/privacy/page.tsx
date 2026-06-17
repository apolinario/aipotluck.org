import type { Metadata } from "next";
import Link from "next/link";
import { LIMITS } from "@/lib/limits";

export const metadata: Metadata = {
  title: "Privacy — AI Potluck",
  description: "How AI Potluck handles your data during the open alpha.",
};

const UPDATED = "2026-06-15";
// Derived from the same constant the retention cron sweeps on, so the stated
// retention can't drift from the actual deletion window.
const RETENTION_DAYS = LIMITS.retentionDays;

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[var(--ap-ink)] leading-relaxed">
      <Link
        className="font-mono text-[12px] text-[var(--ap-coral)] underline-offset-2 hover:underline"
        href="/"
      >
        ← back to the chat
      </Link>

      <h1 className="mt-6 font-[var(--font-cormorant)] font-light text-4xl tracking-tight">
        Privacy
      </h1>
      <p className="mt-2 font-mono text-[12px] text-[var(--ap-ink-3)]">
        Open alpha · last updated {UPDATED}
      </p>

      <section className="mt-8 space-y-4 text-[var(--ap-ink-2)]">
        <p>
          AI Potluck stores your conversations only to operate the service — to
          show you your own chat history and to keep the service running — and
          you use it as a guest, with no account or personal details required.
        </p>
        <p>
          Please do not enter sensitive personal information; guest
          conversations are automatically deleted after {RETENTION_DAYS} days.
        </p>
        <p>
          We do not sell your data, and we do not use your conversations to
          train models without your consent.
        </p>
        <p>
          This is an open alpha run by Current AI, a nonprofit coalition — not a
          company — and a fuller privacy statement will follow at public launch.
        </p>
      </section>

      <p className="mt-10 font-mono text-[12px] text-[var(--ap-ink-3)]">
        See also{" "}
        <Link
          className="text-[var(--ap-coral)] underline-offset-2 hover:underline"
          href="/terms"
        >
          Terms &amp; Safety
        </Link>
        .
      </p>
    </main>
  );
}
