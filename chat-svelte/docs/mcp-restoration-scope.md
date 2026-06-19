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
6. **Serving confirm:** verify CSCS serves Apertus with the **native tool-call parser + chat
   template** (`--tool-call-parser apertus`, `tool_chat_template_apertus.jinja`) for multi-tool
   reliability + arg formatting. Single calls already work, so it's not broken — but worth confirming
   for N-tool use. (The known "tools without parameters" bug is documented upstream.)

## Shared dependency

`delegate_to_agent` (the Hermes agent-as-a-tool, agent-service session) needs the **same** loop +
the same bare-decide pattern. **Restore it once; both consume it.** agent-service already builds the
agent as code-as-controller, so the model never carries that loop either.

## Open questions for Josh / Poli

- **The spec:** which Space, which of its tools, expected UX (inline tool result vs a distinct
  "tool" turn in the transcript)?
- Anything user-facing about the Space tool needs to obey the **same voice rules** (machine voice,
  no proactive follow-ups, plain-stated declines).

## Sizing (honest)

This is the not-started general MCP client ("B1b") — bigger than B1a. Decomposed: re-port the MCP
client (mostly adapting existing upstream code) → generalize the loop (extend a proven ~267-line
template) → bare router (reuse an existing pattern) → map/safety wiring. **Multi-day, not
multi-hour**; the re-port and the safety/allowlist layer are the bulk, the loop and router are
leverage off code we already have.
