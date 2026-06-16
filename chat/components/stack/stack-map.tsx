"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MODERATION_DECLINE } from "@/lib/ai/moderation";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MapNode } from "./map-node";
import type { StackMap as StackMapData, StackStatus } from "./types";

// The node every answer genuinely runs through — the model — pulsed while a
// turn streams and persisted after. CSCS is deliberately NOT here: this
// prototype is served via the HF inference provider, not run on CSCS, so
// flashing it per-answer would imply a compute claim that didn't happen (CSCS/
// LUMI stay static as the production-target compute layer). Router likewise
// stays a static `building` node — nothing routes today.
const TURN_PULSE = new Set(["apertus"]);

const COVERAGE_LEGEND: {
  key: StackStatus;
  label: string;
  mark: string;
  color: string;
}[] = [
  { key: "live", label: "live", mark: "●", color: "var(--ap-live)" },
  {
    key: "building",
    label: "building",
    mark: "●",
    color: "var(--ap-building)",
  },
  { key: "gap", label: "gap", mark: "●", color: "var(--ap-gap)" },
  {
    key: "wanted",
    label: "open invitations",
    mark: "○",
    color: "var(--ap-ink-3)",
  },
];

const WANTED_FILL =
  "repeating-linear-gradient(45deg,#d6d0c6,#d6d0c6 4px,#e7e2da 4px,#e7e2da 8px)";

export function StackMap({
  status,
  messages,
  mobileActive = false,
}: {
  status: string;
  messages: ChatMessage[];
  // Below md the map shares the viewport with the chat via a tab switcher in
  // ChatShell; this says whether the map tab is the active one. From md up the
  // map is always visible and this is ignored.
  mobileActive?: boolean;
}) {
  const [data, setData] = useState<StackMapData | null>(null);
  // The currently-highlighted ("show on map" / safety event) node ids. React
  // state — NOT an imperative class — so the highlight survives the re-render
  // an incoming chat message triggers (which was wiping the old classList).
  const [trailIds, setTrailIds] = useState<string[]>([]);
  // Registry of node id → DOM element, so badges can scroll specific nodes.
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/stack-map.json`)
      .then((r) => r.json())
      .then((d: StackMapData) => {
        if (!cancelled) {
          setData(d);
        }
      })
      .catch(() => {
        /* map is non-critical chrome */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // "show on map" → flash the referenced nodes (matches the POC's flash).
  useEffect(() => {
    function onFlash(e: Event) {
      const ids = (e as CustomEvent<{ ids: string[] }>).detail?.ids ?? [];
      // Only the most recent highlight stays, so the trail always points at the
      // latest event. State-driven → survives subsequent re-renders.
      setTrailIds(ids);
      // Keep the last highlighted cell in view. Deferred a frame so the node is
      // mounted/registered (e.g. a safety event that just changed the map).
      requestAnimationFrame(() => {
        const lastId = ids.at(-1);
        const el = lastId ? nodeRefs.current.get(lastId) : null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    window.addEventListener("ap:flash", onFlash);
    return () => window.removeEventListener("ap:flash", onFlash);
  }, []);

  const active = status === "streaming" || status === "submitted";
  // Scroll the first pulsed node into view when a turn begins — BUT only if a
  // deliberate flash (search / "show on map") hasn't already positioned the map.
  // A search flashes the Web search cell and scrolls to it; without this guard
  // the turn-start scroll would immediately yank back up to apertus (the
  // "down then straight back up" jump). When a trail is active, leave the
  // focused cell in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger on turn start
  useEffect(() => {
    if (!active || trailIds.length > 0) {
      return;
    }
    const firstId = [...TURN_PULSE].find((id) => nodeRefs.current.has(id));
    if (firstId) {
      nodeRefs.current
        .get(firstId)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [active]);

  // When a turn finishes, PERSIST the nodes behind that answer as the highlight
  // so the green doesn't vanish — the inconsistency was that apertus/cscs lit
  // only while `active` (transient) then reverted, while search/safety/show-on-
  // map highlights persisted. Now every highlight persists. The persisted set is
  // the answer's REAL provenance: model + compute always; the Web search node if
  // it searched; the safety node if it was a moderation decline. Stays until the
  // next answer (or a show-on-map click) updates it.
  const wasActiveRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: settle on turn end
  useEffect(() => {
    if (active) {
      wasActiveRef.current = true;
      return;
    }
    if (!wasActiveRef.current) {
      return;
    }
    wasActiveRef.current = false;
    const lastAnswer = [...(messages ?? [])]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAnswer) {
      return;
    }
    const text = (lastAnswer.parts ?? [])
      .filter((p) => p.type === "text")
      .map((p) => ("text" in p ? p.text : ""))
      .join(" ")
      .trim();
    const searched = (lastAnswer.parts ?? []).some(
      (p) => p.type === "data-sources"
    );
    if (text === MODERATION_DECLINE) {
      setTrailIds(["toxicbert"]);
    } else if (searched) {
      setTrailIds(["websearch", ...TURN_PULSE]);
    } else {
      setTrailIds([...TURN_PULSE]);
    }
  }, [active]);

  const counts = data?.coverage;
  const totalForBar = useMemo(() => {
    if (!counts) {
      return 1;
    }
    return Math.max(
      1,
      counts.live + counts.building + counts.gap + counts.wanted
    );
  }, [counts]);

  return (
    <aside
      className={cn(
        "min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(120%_90%_at_70%_0%,var(--ap-map-grad-1),var(--ap-map-grad-2))] md:flex md:border-[var(--ap-rule)] md:border-l",
        mobileActive ? "flex min-h-0 w-full" : "hidden"
      )}
    >
      {/* header */}
      <div className="flex-shrink-0 px-[22px] pt-[14px] pb-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{
              background: active ? "var(--ap-coral)" : "var(--ap-ink-3)",
              opacity: active ? 1 : 0.5,
            }}
          />
          <span className="font-mono text-[10px] text-[var(--ap-ink-3)] uppercase tracking-[0.1em]">
            Under the hood{active ? " · running" : ""}
          </span>
        </div>
        <h2 className="mt-0.5 font-serif text-[24px] text-[var(--ap-ink)]">
          What's behind every answer
        </h2>
        {/* Honest prototype-vs-production disclosure: the compute nodes below
            are the real sovereign target, but this prototype is HF-served. */}
        <p className="mt-1 text-[11px] text-[var(--ap-ink-3)] leading-snug">
          This prototype is served via HuggingFace for speed; the production
          stack runs on the sovereign compute shown below.
        </p>
      </div>

      {/* coverage bar */}
      {counts && (
        <div className="flex-shrink-0 px-[22px] pb-1">
          <div className="flex h-[9px] overflow-hidden rounded-[5px] border border-[var(--ap-rule)]">
            <span style={{ flex: counts.live, background: "var(--ap-live)" }} />
            <span
              style={{
                flex: counts.building,
                background: "var(--ap-building)",
              }}
            />
            <span style={{ flex: counts.gap, background: "var(--ap-gap)" }} />
            <span style={{ flex: counts.wanted, background: WANTED_FILL }} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px]">
            {COVERAGE_LEGEND.map((l) => (
              <span key={l.key} style={{ color: l.color }}>
                {l.mark} {counts[l.key]} {l.label}
              </span>
            ))}
            <span className="text-[var(--ap-ink-3)] opacity-70">
              · click a component to inspect what's behind it
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="sr-only">{totalForBar}</span>
        </div>
      )}

      {/* layers */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1.5 pb-[22px]">
        {data?.layers.map((layer) => (
          <div
            className="flex items-center gap-[14px] border-[var(--ap-rule)] border-b border-dashed py-[9px] last:border-b-0"
            key={layer.label}
          >
            <div className="flex flex-1 flex-wrap gap-[10px]">
              {layer.nodes.map((node) => (
                <MapNode
                  key={node.id}
                  node={node}
                  nodeRef={(el) => {
                    if (el) {
                      nodeRefs.current.set(node.id, el);
                    } else {
                      nodeRefs.current.delete(node.id);
                    }
                  }}
                  pulsed={active && TURN_PULSE.has(node.id)}
                  trailed={trailIds.includes(node.id)}
                />
              ))}
            </div>
            <div className="w-[68px] shrink-0 text-right font-mono text-[10px] text-[var(--ap-ink-3)] uppercase tracking-[0.1em]">
              {layer.label}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
