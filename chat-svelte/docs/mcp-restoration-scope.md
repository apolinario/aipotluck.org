# MCP restoration scope — for the HF Spaces integration

**Audience:** Josh / Poli. **Status:** scoping. **Owner:** chat (Gap Chat / chat-svelte).
**Context:** the HF Spaces integration on the `chat-ui-migration` fork "will require us to bring
back in the MCP integrations on chat-ui" (Josh, 2026-06-17).

## TL;DR

The MCP subsystem was deleted when we forked chat-ui → chat-svelte (the alpha had tools off).
Bringing it back is a real re-port, not a flag flip. The right architecture is **not** "re-add MCP
and let the chat model decide to call the Space's tool mid-answer" — that path is wrong for us on
**two independent grounds** (measured model behavior *and* the product's signed-off voice rules).
The correct shape is: **a bare-prompt router (or code) decides a tool is needed and extracts its
args → code invokes the Space's MCP endpoint → the result is fed back and the chat answers grounded.**
No tool decision is ever made by the persona-framed chat model.

## Current state (verified)

- **No MCP subsystem on the live trunk.** chat-ui's `mcp/` + `tools/` were stripped at fork.
  `textGeneration/index.ts` goes straight to text generation; `endpointOai.ts` sends no `tools`.
- **Groundwork we can build on:**
  - A *parked* single-tool in-stream loop (`b1a-instream-tool-loop` branch): `toolSearchLoop.ts`
    (~267 lines) already parses `tool_calls` mid-stream and continues with tool-role messages — for
    one hardcoded `web_search` tool. This is the loop *mechanism* MCP tools plug into. Not merged.
  - A proven bare-prompt decision pattern (the search-decision work / `decideSearchViaTool`).
- **Web search already works** without persona tool-calling (heuristic + bare classifier decides →
  evidence injected → the chat answers with citations). This already satisfies the launch doc's
  "show its method" web-search requirement.

## Why bare-router, not in-context tool-choice (two independent reasons)

1. **Measured model behavior.**
   - Served 8B (`Apertus-1.5-8B-sft-dpo-tools`): on a bare prompt the model emits clean tool_calls
     and decides search well (**~85%** held-out). Under our full system prompt the same decision
     drops to **0%** — even with an explicit "you can call web_search" directive. (Search-decision
     eval, `evals/search-decision/`.) Confirmed independently by the world-model session: the
     persona suppresses a *chosen action* (tool-call) but not a *factual judgment*.
   - 70B (`Apertus-70B-Instruct-2509`): single tool call is fine (8/8, but drops to 2/8 under
     negation-priming — phrasing-sensitive). The weakness is the **multi-turn loop**: naked
     controller 0/8 (fabricates "done" and bails ~1 step in) → hybrid code-as-controller 8/8.
     (agent-service probes.)
   - Net: on our checkpoints the model should not carry the tool-decision or the multi-turn loop.

2. **Product voice rules (Alpha launch content §1.1 — a design constraint reviewed at every
   sign-off).** The persona is *engineered to be non-proactive*: "the product **does not volunteer
   the next task**… does not suggest conclusions the user did not ask for"; Laura's ask-don't-tell
   reframe — "a **responding machine, not a proactive assistant**." Deciding to call a tool *is*
   proactive behavior. So the model's tool-suppression under the persona is **the persona working as
   specified**, not a bug. Making the persona tool-eager would violate the signed-off voice rules.

The bare-router architecture is therefore *aligned with the product design*, not a workaround for a
weak model. That's the framing to carry: tool decisions live outside the passive persona by design.

## Work breakdown

1. **Re-port the MCP client** (`src/lib/server/mcp/`, from upstream chat-ui): connect to MCP
   servers (SSE/HTTP), discover tools, convert them to OpenAI function schemas. Config via
   `MCP_SERVERS`. For an HF **Space**: a Gradio app with `mcp_server=True` exposes
   `/gradio_api/mcp/sse` — that's the endpoint we connect to.
2. **Generalize the in-stream tool loop** from the parked b1a single-`web_search` loop to **N MCP
   tools**: parse `tool_calls` deltas, execute (call the MCP server), append the tool-role result,
   continue the completion. (This is the "Commit B" b1a explicitly deferred.)
3. **Bare decide+extract router** — the reliability + voice-rules-compliant layer: a clean-prompt
   call (no persona) that decides whether to invoke a Space tool and authors its args. Reuses the
   `decideSearchViaTool` / `classifySearchNeed` pattern.
4. **Surfacing + provenance:** add the Space as a node in the "Under the hood" map; label it
   honestly as a non-Apertus component; gate behind a per-Space feature flag.
5. **Safety (non-negotiable):** the moderation pre-screen stays in front. **A Space's tool output is
   untrusted content** — treat as data, never instructions (injection guard on args *and* results).
   Per-Space allowlist; external tool calls are an execution surface.
6. **Serving confirm — DONE** (`evals/tool-serving-probe/`, probed live CSCS): multi-tool
   discrimination + arg extraction work cleanly (`get_weather({location:"Geneva"})`,
   `web_search({query:...})` picked correctly among 2–3 tools). The **no-argument-tool case is
   broken** — the documented Apertus "tools without parameters" bug is live (leaks
   `<|tools_prefix|>` instead of a parseable call). **Our bare-router+code-invokes design
   sidesteps it** (code constructs the call; no-arg tools need no model arg-extraction), so **no
   serving change is required.** It would only matter if someone wired in-stream model-driven
   `tool_calls` (we don't) — and even then there's a trivial **workaround, verified**: pad a
   no-arg tool's schema with one dummy param (optional `_` → `{"_":""}`, or required `noop` →
   `{"noop":"check"}`) and the model emits a clean parseable call; the code strips the dummy
   before invoking the real tool. So the no-params bug is fully neutralizable either way.

## Shared dependency

`delegate_to_agent` (the Hermes agent-as-a-tool, agent-service session) needs the **same** loop +
the same bare-decide pattern. **Restore it once; both consume it.** agent-service already builds the
agent as code-as-controller, so the model never carries that loop either.

## Open questions for Josh / Poli

- **The spec:** which Space, which of its tools, expected UX (inline tool result vs a distinct
  "tool" turn in the transcript)?
- Anything user-facing about the Space tool needs to obey the **same voice rules** (machine voice,
  no proactive follow-ups, plain-stated declines).

## Predicted spec (draft to build against; refine when Josh confirms)

Josh will specify this by reasoning about it (likely with an AI) — so here's the most probable
shape, to start the vertical slice now. The integration is **Space-agnostic below the tool
schema**, so his eventual answer only swaps the tool definition + map node.

**What it almost certainly is:** wire one (or a few) open-source HF **Spaces** as callable tools,
each surfaced as a **live node on the "Under the hood" map** that pulses when the chat uses it —
the thesis (a capable assistant *assembled from open parts*) made literal and visible. The chat
gains a capability it lacks on its own, supplied by an open component, shown on the map.

**Hard constraint: no file uploads in the alpha.** So any tool whose input is a user-supplied
file (vision/`analyze_image`, OCR, document, audio) has nothing to act on — **ruled out for the
alpha** (revisit when uploads ship post-launch; a vision Space could still serve as a throwaway
*wiring sample* if a clean one is handy).

**Recommended concrete pick (text-in, no files): an open translation Space.**
- "Multilingual" is a literal *WE ARE* principle — an open MT model (NLLB / SeamlessM4T-text /
  similar) lets the chat handle low-resource languages the base model is weak in. Directly serves
  the global-south / sovereign framing for the summit audience.
- Text → text, so the chat UI renders it with no new surface; serious tone (not a flashy gimmick).
- One Space, one tool (`translate(text, target_language)`) = "relatively straightforward."

**Alternatives (identical wiring, only schema + node change):** an open **image-generation** Space
(text → image; visible artifact, but check tone for the ministerial audience + that the UI renders
image output), a **specialized open-model** Space (route a domain query to a stronger open model),
or a partner's specific Space. All are text-in, so all clear the no-upload constraint.

**UX:** on a Space-tool call, the matching map node pulses (reuse the `ap:flash`/AgentStep pulse
agent-service built), the answer is grounded in the Space's output, provenance attributes the
component honestly — same "what's behind every answer" pattern as search.

**Scope (for "straightforward"):** IN — 1 Space, gated, map node, bare-router decide+invoke,
provenance. OUT — general MCP marketplace, user-added Spaces, multi-Space chaining.

**The only genuine unknowns (Josh's call):** (1) which Space/capability (recommend vision; he may
have a partner-specific one); (2) one showcase Space vs a small set; (3) builder attribution on the
map. Everything below the tool schema we can build now.

## Sizing (honest)

This is the not-started general MCP client ("B1b") — bigger than B1a. Decomposed: re-port the MCP
client (mostly adapting existing upstream code) → generalize the loop (extend a proven ~267-line
template) → bare router (reuse an existing pattern) → map/safety wiring. **Multi-day, not
multi-hour**; the re-port and the safety/allowlist layer are the bulk, the loop and router are
leverage off code we already have.
