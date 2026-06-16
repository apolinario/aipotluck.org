"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// The "what happens after the chat" contribution paths (Feature Lock §6 / Web UX
// Phase 6), as real in-app forms writing to our own DB (no third-party list, so
// no list-vendor decision is blocked). Two of the three spec paths:
//   - Stay informed  → email only.
//   - Raise your hand → name / org / contribution type / detail.
// "Build with the API" stays a doc pointer for now (no public API yet).

const KINDS = [
  { key: "subscribe", label: "Stay informed" },
  { key: "contribute", label: "Raise your hand" },
] as const;

type Kind = (typeof KINDS)[number]["key"];

const TYPES = [
  { value: "compute", label: "Compute" },
  { value: "data", label: "Data" },
  { value: "code", label: "Code" },
  { value: "funding", label: "Funding" },
  { value: "other", label: "Other" },
] as const;

type ContributionType = (typeof TYPES)[number]["value"];

export function ContributeDialog({
  triggerClassName,
  triggerLabel = "How to contribute",
}: {
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("subscribe");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [contributionType, setContributionType] =
    useState<ContributionType | null>(null);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail("");
    setName("");
    setOrganization("");
    setContributionType(null);
    setDetail("");
  };

  const submit = async () => {
    if (!email.trim()) {
      toast.error("An email is required so we can follow up.");
      return;
    }
    if (kind === "contribute" && !contributionType) {
      toast.error("Pick what you can contribute.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/contribute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            email: email.trim(),
            name: name.trim() || null,
            organization: organization.trim() || null,
            contributionType: kind === "contribute" ? contributionType : null,
            detail: detail.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        throw new Error("contribute failed");
      }
      toast.success(
        kind === "subscribe"
          ? "Thanks — we'll let you know when the beta launches."
          : "Thanks — we'll be in touch about contributing."
      );
      setOpen(false);
      reset();
    } catch {
      toast.error("Couldn't send that. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        className={cn(
          "rounded-full border border-[var(--ap-rule)] px-4 py-2 font-mono text-[11px] text-[var(--ap-ink)] uppercase tracking-[0.08em] transition-colors hover:bg-[var(--ap-ink)]/5",
          triggerClassName
        )}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get involved</DialogTitle>
          <DialogDescription>
            AI Potluck is a public utility built in the open. Leave a way to
            reach you, or tell us what you can bring.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-full border border-border/60 p-1">
          {KINDS.map((k) => (
            <button
              className={cn(
                "flex-1 rounded-full py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                kind === k.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              key={k.key}
              onClick={() => setKind(k.key)}
              type="button"
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {kind === "contribute" && (
            <>
              <div className="flex gap-2">
                <Input
                  aria-label="Your name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  value={name}
                />
                <Input
                  aria-label="Organisation"
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Organisation"
                  value={organization}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <Button
                    key={t.value}
                    onClick={() => setContributionType(t.value)}
                    size="sm"
                    type="button"
                    variant={
                      contributionType === t.value ? "default" : "outline"
                    }
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </>
          )}

          <Input
            aria-label="Email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@organisation.org"
            type="email"
            value={email}
          />

          {kind === "contribute" && (
            <Textarea
              maxLength={2000}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Anything else? (optional)"
              rows={3}
              value={detail}
            />
          )}

          <Button disabled={submitting} onClick={submit} type="button">
            {submitting
              ? "Sending…"
              : kind === "subscribe"
                ? "Keep me posted"
                : "Send"}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground/70">
            Building on the stack? API access is on the way — pick “Raise your
            hand” and say so.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
