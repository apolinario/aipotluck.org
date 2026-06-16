"use client";

import { MODEL } from "@/lib/ai/model-identity";

// "show on map" flashes the MODEL node — the thing the badge names that the
// answer genuinely ran on. The compute it used is the inference provider (named
// in the badge text), which has no map node; the sovereign-compute nodes
// (CSCS/LUMI) stay as the static production-target layer rather than flashing
// per-answer (this prototype is HF-served, not run on them).
const MODEL_NODES = ["apertus"];

// Friendly names for known HF inference providers (the raw header value is a
// slug). Public AI is the sovereign-inference provider serving Apertus here.
const PROVIDER_NAMES: Record<string, string> = {
  publicai: "Public AI",
};

function providerDisplay(provider?: string): string {
  if (!provider) {
    // No header captured (historical message / pre-resolve) — fall back to the
    // model identity's serving label rather than inventing a provider.
    return MODEL.compute;
  }
  return (
    PROVIDER_NAMES[provider.toLowerCase()] ??
    provider.replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// The third slot is the ACTUAL inference provider that served this answer (read
// per-request from the HF router's x-inference-provider header), not a hardcoded
// compute box — so the badge can't claim a datacenter the request didn't hit.
export function ProvenanceBadge({ provider }: { provider?: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]">
      <span
        className="size-[6px] shrink-0 rounded-full"
        style={{ background: "var(--ap-live)" }}
      />
      <span>{`${MODEL.short} · ${MODEL.makerShort} · ${providerDisplay(provider)}`}</span>
      <button
        className="text-[var(--ap-coral)] underline-offset-2 hover:underline"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("ap:flash", { detail: { ids: MODEL_NODES } })
          )
        }
        type="button"
      >
        show on map ↗
      </button>
    </div>
  );
}
