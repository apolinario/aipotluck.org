// Behavioral eval for the chat, ported from the gap-chat (app/evals/run.mjs)
// and adapted to the fork's prompt pipeline. Builds the SAME prompt the route
// builds — systemPrompt() + hardenLastUserTurn() (grounding + guard) — and the
// SAME decoding params, then calls the model directly and scores each golden
// case over N runs (so wrong-then-right variance shows as a pass-rate, not a
// vibe). Reuses the ported logic so the eval can't silently drift from the route.
//
//   pnpm eval            # 3 runs/case
//   pnpm eval 5          # 5 runs/case
//   pnpm eval 1 vLLM     # 1 run, only cases whose name matches "vLLM"
//
// NOT part of `pnpm test:unit`: it needs HF_TOKEN and makes real (paid),
// non-deterministic calls. The model is the variable under test.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelMessage } from "ai";
import { ground, hardenLastUserTurn } from "../lib/ai/grounding";
import { MODEL_ID } from "../lib/ai/model-identity";
import { type RequestHints, systemPrompt } from "../lib/ai/prompts";
import { LIMITS } from "../lib/limits";

const here = dirname(fileURLToPath(import.meta.url));

// Load HF_TOKEN from .env.local (no dotenv dep), falling back to ambient env.
try {
  for (const line of readFileSync(join(here, "..", ".env.local"), "utf8").split(
    "\n"
  )) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ambient env */
}
if (!process.env.HF_TOKEN) {
  console.error("FAIL: HF_TOKEN not set (looked in chat/.env.local + env)");
  process.exit(2);
}

type Turn = { role: "user" | "assistant"; content: string };

type Case = {
  name: string;
  // Single-turn cases use `prompt`; multi-turn cases use `turns` (a prior
  // conversation whose FINAL user turn is the one under test). Exactly one of
  // the two is set. Assertions always score the model's reply to the last turn.
  prompt?: string;
  turns?: Turn[];
  expectCategory?: string;
  expectNoCategory?: boolean;
  mustContain?: string[];
  mustContainAny?: string[];
  mustNotContain?: string[];
  mustMatch?: string;
  mustNotMatch?: string;
};

const CASES: Case[] = JSON.parse(
  readFileSync(join(here, "cases.json"), "utf8")
);
const RUNS = Number(process.argv[2]) || 3;
const FILTER = process.argv[3];

const EMPTY_HINTS: RequestHints = {
  latitude: undefined,
  longitude: undefined,
  city: undefined,
  country: undefined,
};

async function callModel(c: Case) {
  // Build the exact prompt the route builds: ground + harden the user turn,
  // then the system prompt (tools disabled, no search grounding for evals).
  // Multi-turn cases replay the prior conversation; single-turn cases are the
  // one-user-message path, unchanged.
  const messages: ModelMessage[] = c.turns
    ? c.turns.map((t) => ({ role: t.role, content: t.content }) as ModelMessage)
    : [{ role: "user", content: c.prompt ?? "" }];
  // hardenLastUserTurn grounds over ALL user turns and hardens the last one,
  // returning the conversation-level category.
  const conversationCat = hardenLastUserTurn(messages);
  const system = systemPrompt({
    requestHints: EMPTY_HINTS,
    supportsTools: false,
  });

  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_ID ?? "swiss-ai/Apertus-70B-Instruct-2509",
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.1,
      frequency_penalty: 0.4,
      presence_penalty: 0.3,
      max_tokens: LIMITS.maxOutputTokens,
    }),
  });
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  // Single-turn keeps the exact ground(prompt) scoring it always used; multi-turn
  // uses the conversation-level category from the harden pass.
  const category = c.turns
    ? conversationCat
    : (ground(c.prompt ?? "")?.id ?? "");
  return { status: res.status, text, category };
}

function check(
  c: Case,
  r: { status: number; text: string; category: string }
): string | null {
  const low = r.text.toLowerCase();
  if (r.status !== 200) {
    return `HTTP ${r.status}`;
  }
  if (!r.text.trim()) {
    return "empty answer";
  }
  if (c.expectCategory && r.category !== c.expectCategory) {
    return `category "${r.category || "(none)"}" ≠ "${c.expectCategory}"`;
  }
  if (c.expectNoCategory && r.category) {
    return `expected no category, got "${r.category}"`;
  }
  for (const s of c.mustContain ?? []) {
    if (!low.includes(s.toLowerCase())) {
      return `missing "${s}"`;
    }
  }
  if (
    c.mustContainAny &&
    !c.mustContainAny.some((s) => low.includes(s.toLowerCase()))
  ) {
    return `none of [${c.mustContainAny.join(", ")}]`;
  }
  for (const s of c.mustNotContain ?? []) {
    if (low.includes(s.toLowerCase())) {
      return `contains forbidden "${s}"`;
    }
  }
  if (c.mustMatch && !new RegExp(c.mustMatch, "i").test(r.text)) {
    return `no match /${c.mustMatch}/`;
  }
  if (c.mustNotMatch && new RegExp(c.mustNotMatch, "i").test(r.text)) {
    return `matched forbidden /${c.mustNotMatch}/`;
  }
  return null;
}

async function main() {
  const cases = CASES.filter((c) => !FILTER || c.name.includes(FILTER));
  console.log(
    `\nBehavioral eval — ${cases.length} cases × ${RUNS} runs (model is the variable; not cached)\n`
  );

  let allGreen = true;
  for (const c of cases) {
    let passes = 0;
    let firstFail: { reason: string; snippet: string } | null = null;
    for (let i = 0; i < RUNS; i++) {
      const r = await callModel(c);
      const fail = check(c, r);
      if (fail) {
        firstFail ??= {
          reason: fail,
          snippet: r.text.slice(0, 110).replace(/\n/g, " "),
        };
      } else {
        passes++;
      }
    }
    const rate = passes / RUNS;
    const mark = rate === 1 ? "✅" : rate === 0 ? "❌" : "⚠️ ";
    if (rate < 1) {
      allGreen = false;
    }
    console.log(
      `${mark} ${passes}/${RUNS}${passes > 0 && passes < RUNS ? " FLAKY" : ""}  ${c.name}`
    );
    if (firstFail) {
      console.log(`     ↳ ${firstFail.reason}  ·  "${firstFail.snippet}…"`);
    }
  }

  console.log(`\n${allGreen ? "✅ all green" : "❌ failures/flakes above"}\n`);
  process.exit(allGreen ? 0 : 1);
}

main();
