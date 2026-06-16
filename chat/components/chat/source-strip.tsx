"use client";

import { useState } from "react";
import type { SearchSource } from "@/lib/search/open-search";

// Provenance for a search-grounded answer: the numbered open sources the model
// was told to cite. Collapsible to stay out of the way; every [n] in the answer
// resolves to a row here. "show on map" flashes the Web-search node so the chat
// event is mirrored in the live stack. Wikipedia is labeled authoritative-current;
// Marginalia is labeled broader-open-web (varies) — the honesty the thesis needs.
const ENGINE_META: Record<
  SearchSource["engine"],
  { tag: string; note: string; color: string }
> = {
  Wikipedia: {
    tag: "Wikipedia",
    note: "open public knowledge",
    color: "var(--ap-live)",
  },
  Marginalia: {
    tag: "Marginalia",
    note: "broader open web · varies",
    color: "var(--ap-building)",
  },
};

function flashWebsearch() {
  window.dispatchEvent(
    new CustomEvent("ap:flash", { detail: { ids: ["websearch"] } })
  );
}

export function SourceStrip({
  sources,
  asOf,
  query,
}: {
  sources: SearchSource[];
  asOf: string;
  query?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) {
    return null;
  }
  const date = asOf?.slice(0, 10);

  return (
    <div className="mt-1.5 rounded-lg border border-[var(--ap-rule)] bg-[var(--ap-paper)]/40 font-mono text-[10.5px]">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          className="flex items-center gap-1.5 text-[var(--ap-ink-2)] transition-colors hover:text-[var(--ap-ink)]"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          <span
            className="size-[6px] shrink-0 rounded-full"
            style={{ background: "var(--ap-live)" }}
          />
          <span>
            {sources.length} open source{sources.length === 1 ? "" : "s"}
            {date ? ` · as of ${date}` : ""}
          </span>
          <span className="text-[var(--ap-ink-3)]">{open ? "▾" : "▸"}</span>
        </button>
        <button
          className="ml-auto text-[var(--ap-coral)] underline-offset-2 hover:underline"
          onClick={flashWebsearch}
          type="button"
        >
          show on map ↗
        </button>
      </div>

      {open && (
        <div className="border-[var(--ap-rule)] border-t">
          {query && (
            <div className="px-2.5 pt-2 text-[var(--ap-ink-3)]">
              searched open sources for:{" "}
              <span className="text-[var(--ap-ink-2)]">“{query}”</span>
            </div>
          )}
          <ol className="flex flex-col gap-1.5 px-2.5 py-2">
            {sources.map((s) => {
              const meta = ENGINE_META[s.engine];
              return (
                <li className="flex gap-2 leading-snug" key={s.n}>
                  <span className="shrink-0 text-[var(--ap-ink-3)]">
                    [{s.n}]
                  </span>
                  <span className="min-w-0">
                    <a
                      className="break-words text-[var(--ap-ink)] underline-offset-2 hover:underline"
                      href={s.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {s.title}
                    </a>
                    <span className="ml-1.5 whitespace-nowrap">
                      <span style={{ color: meta.color }}>● </span>
                      <span className="text-[var(--ap-ink-3)]">
                        {meta.note}
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
