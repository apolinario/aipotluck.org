"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { STATUS_LABEL, STATUS_VAR, type StackNode } from "./types";

const compact = new Intl.NumberFormat("en", { notation: "compact" });

export function MapNode({
  node,
  pulsed,
  trailed,
  nodeRef,
}: {
  node: StackNode;
  pulsed?: boolean;
  // Persistent "show on map" / safety-event highlight. Driven by React state in
  // StackMap (not an imperative classList) so it survives the re-render an
  // incoming chat message triggers — that re-render was wiping the old class.
  trailed?: boolean;
  nodeRef?: (el: HTMLButtonElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const isWanted = node.st === "wanted";
  const color = STATUS_VAR[node.st];
  const atlas = node.atlas;

  return (
    <button
      className={cn(
        "group relative flex flex-1 basis-[200px] flex-col select-text rounded-[10px] border-[1.5px] px-[15px] py-[10px] text-left transition-[border-color,box-shadow] duration-150",
        isWanted
          ? "border-dashed bg-transparent"
          : "border-[var(--ap-rule)] bg-[var(--ap-paper)]",
        // Both "running this turn" (pulsed) and "show on map / safety event"
        // (trailed) use the SAME calm green wash — no animate-pulse, no coral.
        // (The old pulsed path flashed fast + red; "running" is signalled by
        // the header dot, the node just gets the quiet highlight.)
        (pulsed || trailed) && "ap-trail"
      )}
      onClick={() => setOpen((o) => !o)}
      ref={nodeRef}
      style={{
        minWidth: 185,
        borderLeft: `4px ${isWanted ? "dashed" : "solid"} ${color}`,
        ...(isWanted
          ? { borderColor: "var(--ap-ink-3)", borderLeftColor: color }
          : {}),
      }}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium text-[14px] text-[var(--ap-ink)]">
            <span
              className="size-[9px] shrink-0 rounded-full"
              style={
                isWanted
                  ? {
                      background: "transparent",
                      border: "1.5px solid var(--ap-ink-3)",
                    }
                  : { background: color }
              }
            />
            <span className="truncate">{node.nm}</span>
          </div>
          <div className="mt-0.5 truncate text-[12px] text-[var(--ap-ink-3)]">
            {node.org}
          </div>
        </div>
        <span
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: isWanted ? "var(--ap-coral)" : color }}
        >
          {STATUS_LABEL[node.st]}
        </span>
      </div>

      <div className="mt-1.5 text-[11.5px] text-[var(--ap-ink-2)] leading-snug">
        {node.d}
      </div>

      {/* Subtle "expandable" affordance — clarifies the card is clickable to
          inspect; strengthens on hover, flips when open. */}
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-2 bottom-2 size-3 text-[var(--ap-ink-3)] opacity-25 transition-[transform,opacity] duration-200 group-hover:opacity-70",
          open && "rotate-180 opacity-50"
        )}
      />

      {open && (
        <div className="mt-2 border-[var(--ap-rule)] border-t border-dashed pt-2">
          {atlas ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--ap-ink-3)]">
                <span>
                  ★ {atlas.stars != null ? compact.format(atlas.stars) : "—"}
                  {atlas.stars7d
                    ? ` (+${compact.format(atlas.stars7d)}/wk)`
                    : ""}
                </span>
                {atlas.sparkline && <Sparkline values={atlas.sparkline} />}
              </div>
              <div className="font-mono text-[10px] text-[var(--ap-ink-3)] leading-[1.7]">
                {atlas.contributors != null && (
                  <span>
                    {compact.format(atlas.contributors)} contributors ·{" "}
                  </span>
                )}
                {atlas.language && <span>{atlas.language} · </span>}
                {atlas.commits90d != null && (
                  <span>{compact.format(atlas.commits90d)} commits/90d · </span>
                )}
                <span>{atlas.openness}</span>
                {atlas.license ? <span> · {atlas.license}</span> : null}
              </div>
              <div className="font-mono text-[10px] text-[var(--ap-ink-3)]">
                via OSO product-view
              </div>
            </div>
          ) : (
            <div className="font-mono text-[10px] text-[var(--ap-ink-3)] leading-[1.7]">
              {isWanted
                ? "open projects exist for this"
                : (node.prov ?? "provenance on the live stack")}
            </div>
          )}
          {node.lineage && (
            <div className="mt-2 space-y-1 border-[var(--ap-rule)] border-t border-dashed pt-2">
              <div className="font-mono text-[10px] text-[var(--ap-ink-2)]">
                training data — {node.lineage.summary}
              </div>
              {node.lineage.facts?.length ? (
                <ul className="font-mono text-[10px] text-[var(--ap-ink-3)] leading-[1.7]">
                  {node.lineage.facts.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              ) : null}
              {node.lineage.links?.length ? (
                <div className="flex flex-wrap gap-3 font-mono text-[10px]">
                  {node.lineage.links.map((l) => (
                    <a
                      className="text-[var(--ap-coral)] underline-offset-2 hover:underline"
                      href={l.url}
                      key={l.url}
                      onClick={(e) => e.stopPropagation()}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-2 flex gap-3 font-mono text-[10px]">
            {(atlas?.url ?? node.url) && (
              <a
                className="text-[var(--ap-ink-2)] underline-offset-2 hover:underline"
                href={atlas?.url ?? node.url}
                onClick={(e) => e.stopPropagation()}
                rel="noreferrer"
                target="_blank"
              >
                {node.url && !atlas ? "Open weights ↗" : "GitHub ↗"}
              </a>
            )}
            {(isWanted || node.st === "gap") && (
              <a
                className="font-semibold text-[var(--ap-coral)] underline-offset-2 hover:underline"
                href={`mailto:contact@aipotluck.org?subject=${encodeURIComponent(
                  `Get involved: ${node.nm}`
                )}`}
                onClick={(e) => e.stopPropagation()}
              >
                Get involved →
              </a>
            )}
          </div>
        </div>
      )}
    </button>
  );
}
