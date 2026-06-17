"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageAction as Action } from "../ai-elements/message";
import { WarningIcon } from "./icons";

const REASONS = [
  { value: "harmful", label: "Harmful or unsafe" },
  { value: "inaccurate", label: "Inaccurate" },
  { value: "privacy", label: "Privacy concern" },
  { value: "other", label: "Other" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

export function ReportDialog({
  chatId,
  messageId,
}: {
  chatId: string;
  messageId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) {
      toast.error("Pick a reason first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            messageId: messageId ?? null,
            reason,
            detail: detail.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        throw new Error("report failed");
      }
      toast.success("Thanks — your report was sent for review.");
      setOpen(false);
      setReason(null);
      setDetail("");
    } catch {
      toast.error("Couldn't send the report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Action
        className="size-6 text-muted-foreground/50 hover:text-foreground"
        data-testid="message-report"
        onClick={() => setOpen(true)}
        tooltip="Report a problem"
      >
        <WarningIcon />
      </Action>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              Flag this response for review. Reports are stored for the team to
              review — they aren&apos;t automatically triaged yet.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <Button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  size="sm"
                  type="button"
                  variant={reason === r.value ? "default" : "outline"}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <Textarea
              maxLength={2000}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Add any detail (optional)"
              rows={3}
              value={detail}
            />
          </div>
          <DialogFooter>
            <Button disabled={submitting} onClick={submit} type="button">
              {submitting ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
