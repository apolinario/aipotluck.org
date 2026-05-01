# Core roadmap

(Note: the intro paragraphs of this document are omitted in the website UI. Please keep this heading for authoring context. Optional annotations on a step include `@period` e.g. `@period:Q1 26`, `@label:…`, `@label-color`, `@highlight`, and `@status`. Also, only the line immediately after the project title is displayed in the UI. Bullet points prefaced by ^ are displayed as annotations outside the box. All other bullet points are not displayed.)

The AI Potluck thesis is that the public-interest movement does not need a new model lab or a new frontend — it needs a coordinated suite of products assembled from the best open-source contributions in flight, hardened to consumer-grade, and put in the hands of users by the Swiss AI Summit. This roadmap names those products. Each entry is a product surface a user, developer, or partner actually touches; the technical roadmap for each follows in subsequent documents and depends on the quality of the open-source components underneath.

Sequencing is deliberate. Apertus 1.5 and the inference utility are the spine — the chat client, the API, and everything agentic depend on both. Evaluation is treated as a product in its own right because the Summit demands a credibility instrument, not a feature. Trust & safety and the open coordination surface (the stack map) are products too, not afterthoughts.

1. `chat` Browser-based conversational client. The product most users will judge the entire movement by. @highlight:red @label:Public AI + design partner @period:Q3 26 @compare:claude.ai
   ^ Firefox-2005 today; needs to feel like 2026 by the Summit
   - chat.publicai.co exists with 42k registered users; the work is UX overhaul, design system, and closing the table-stakes gap (file upload, web search, vision input, longer context).
   - Privacy-by-default with an independently audited "no training on user data" claim is the loudest differentiator — commission and publish the audit before the Summit.
   - The capability surface (tool use, memory, skills) cascades from Apertus 1.5; coordinate the model and product timelines or this slips into Q4.

2. `mobile-app` Native iOS and Android client. Where most consumer AI usage actually happens. @label:Public AI + contractor @period:Q4 26 @compare:Claude mobile, ChatGPT mobile
   - Most ChatGPT usage is mobile; a web-only product is not competing for the consumer narrative the Summit needs.
   - iOS first, Android close behind — sequential beats two half-shipped platforms.
   - Reuses the same backend, same auth, same memory layer as `chat`; the build is a thin client, not a parallel product.

3. `desktop-app` Native macOS, Windows, and Linux client. For power-users. Important for local-first features, including local/rare data use-cases. @label:Public AI + community @period:Q4 26 @compare:Claude Desktop, ChatGPT Desktop
   - Electron wrapper around `chat` is the cheap path; the design question is whether to invest in anything genuinely native (system tray, global hotkey, local model fallback).
   - Linux support is a small effort that signals seriously to the open-source community — closed labs ship Mac and Windows only.
   - Local model fallback (running Apertus 8B on-device when offline or for privacy-sensitive sessions) is the differentiator worth scoping; nobody else can ship this credibly.

4. `foundation-model` The flagship open-source foundation model and model family. Multi-modal, tool-use, reasoning. @highlight:red @label:Switzerland @period:Q2 26 @compare:Claude Sonnet, GPT-4o
   - Apertus 1.5 (Q2 26) lands tool calling, vision, and longer context — prerequisites for almost every product downstream.
   - Apertus 2 (EOY 26, large MoE) is the frontier-adjacent bet; ship a preview at the Summit even if full capability slips.
   - Don't fund pre-training directly; fund the surrounding infra (data pipelines, fine-tuning recipes, eval harnesses) where Current AI's dollars compound and where multilingual leadership gets reinforced.

5. `inference-platform` Developer-facing API and portal — OpenAI-compatible, sovereign-routed, with SDKs and dashboards developers actually trust. @label:Public AI @period:Q3 26 @compare:Anthropic Console, OpenAI Platform
   - platform.publicai.co exists with 2,000 developers; the work is SLAs, Python and TS SDKs, docs, billing, and uptime dashboards.
   - Multi-model routing positioned as "OpenRouter but sovereign" — the differentiation is provenance and data governance attestations per request, not feature parity.
   - Developer ergonomics are the gate to enterprise adoption and the precondition for any agentic ecosystem; underinvesting here makes the agent and skills products much harder to land.

6. `compute` The pooled, multi-source compute supply that the rest of the stack runs on. For us: most likely sovereign HPC, donated cycles, and (eventually) public inference infrastructure. @label:Finland (LUMI/CSC) + Switzerland (CSCS) + partner universities @period:Q2 26 @compare:no clean analogue — closed labs own captive datacenters
   ^ Compute is the contribution governments actually have to give; the product is making it usable
   - Donation accounting, scheduling, and attestation across LUMI, CSCS, CSC, and partner clusters — the bookkeeping that turns "Finland commits inference credits" from an MOU bullet into routable capacity.
   - Use-case- and donor-specific routing rules (CSCS's stated requirement) are how compute donations get tied to specific public-interest workloads rather than disappearing into a general pool.
   - Public inference infrastructure for other HPCs (later phase) is how this product scales beyond anchor partners and becomes a genuine alternative to hyperscaler captive compute.

7. `edge` A reference stack for running on-device AI. Certified runtime, model, RAG, and update path that OEMs, governments, and field deployments build on. @label:India + Current AI + community (llama.cpp, MLX, Ollama) @period:Q3 26 @compare:no consumer-facing analogue — closed labs structurally can't ship flagship models to devices they don't control
   ^ The one layer where open-source is genuinely ahead of closed labs. Worth pressing the advantage!
   - The product question is which path: reference hardware (India model — single partnership, hard to scale), reference software stack for OEMs (scales but slower payoff), or a local-first mode in `desktop-app` (cheap and immediate). Pick deliberately rather than drifting into all three.
   - Reference software is the bet that compounds — a Yocto/buildroot image plus governance plus update mechanism that any clinic, school, or ministry deployment can flash. STF maintainer funding is the natural underwriter.
   - The use-case wedge is offline/low-bandwidth public services (health field workers, classrooms, government offices in low-connectivity regions) — this is where closed labs literally cannot compete and where the public-interest narrative writes itself.

8. `inference-orchestrator` A distributed sovereign-inference layer that routes requests across the `compute` pool with the right model, latency, and provenance guarantees. @label:Public AI + CSCS + CSC @period:Q2 26 @compare:no clean analogue — closed labs run captive infra
   ^ Arguably the most defensible product in our stack.
   - End-to-end observability across LiteLLM, OpenWebUI, AWS, and CSCS is the prerequisite for SLAs and for helping CSCS hit 24/7 uptime.
   - Endpoint provenance and routing transparency — which sovereign backend served this inference, with attestations gov partners can verify — is the product, not a feature of the API.
   - Use-case- and donation-specific routing (key CSCS requirement) is what turns this from infrastructure into a coordination layer between governments.

9. `evals` Independent, reproducible evaluation suites for foundation models, agentic systems, and safety... but published as a product, not a paper. @label:Finland (ELLIS + CSC) @period:Q2 26 @compare:HELM, UK AISI Inspect, MMLU leaderboards
   - Foundation model evals are the credibility instrument every comparison-to-ChatGPT slide will need; v1 ships before the Summit.
   - Agentic evals are where 2026-27 product competition lives — being early here is a moat for the whole stack, not a Finland project.
   - Safety and red-team benchmarks are non-negotiable for gov partners; the gap in the original Public AI plan closes here.

10. `skills` An open marketplace and authoring surface for reusable, composable model capabilities. @label:Current AI + community @period:Q4 26 @compare:Anthropic Skills, OpenAI GPTs
   - Anthropic's Skills is genuinely new product surface area; an open version with ~10 curated launch skills is a strong potluck play and a clean Summit demo.
   - The marketplace is the durable artifact; individual skills are contributions from the potluck guests.
   - Tied directly to tool calling in Apertus 1.5 — slips if the model slips.

11. `agent` A coding-and-tasks agent built on the open stack — the high-visibility demo that proves the stack can do more than chat. @label:Potluck (Aider, Continue.dev, OpenHands) + Current AI @period:Q4 26 @compare:Claude Code, Codex, Cursor
    - Don't build a new agent framework; pick one (likely MCP-native) and champion it. Fragmentation is the risk, not insufficient choice.
    - Coding is the right wedge — high-visibility, technical-user community, clear benchmarks — but credible-demo, not Cursor-level, is the realistic Summit target.
    - SafeMolt-adjacent agentic R&D runs in parallel as the experimental track and feeds this product without constraining its design.

12. `interviewer` An AI interviewer for structured listening at scale — eliciting input from communities, citizens, and stakeholders, then synthesizing it back. The signature public-interest product the closed labs won't build. @highlight:red @label:Current AI + Public AI CH + delibtech partners @period:Q4 26 @compare:Remesh, Polis, Anthropic deliberation experiments
    ^ The product that proves public-interest AI is a different category, not just a cheaper one
    - The closed labs have no incentive to build this — there's no enterprise contract — but governments, civil society, and gov partners (FR, FI, CH) need it badly.
    - Synergizes directly with Public AI Switzerland's Dialogue Weeks and with the delibtech community Current AI is already adjacent to; the use cases come pre-packaged.
    - Privacy-by-default and verifiable non-training are not optional here — interviewees share things they wouldn't share with ChatGPT, and the trust posture is the product.

13. `trust-and-safety` The moderation, red-teaming, incident response, and data-governance product that makes the stack defensible on day one of public access. @highlight:red @label:Current AI + potluck @period:Q3 26 @compare:no consumer-facing analogue — closed labs run this internally
    - Content moderation (Llama Guard, ShieldGemma) and abuse detection ship before registration opens; otherwise the stack is weaponized within hours.
    - Published incident response and disclosure policy is itself a trust signal — gov partners read these before they sign.
    - Service governance (who decides what ships, who decides what's moderated) needs a public-interest answer, not a corporate one. Metagov-style process is the differentiator.

14. `stack-map` The live, public visualization of the open-source AI ecosystem — the orchestrator's core artifact and the movement's single source of truth. @label:Current AI + OSO @period:Q2 26 @compare:LF AI & Data Landscape, Hugging Face leaderboards
    - Build data-first on OSO infrastructure before commissioning design; a polished frontend over unvalidated data is the failure mode here.
    - The survey (G7), the paper (Columbia), and the live visualization are three deliverables of one product — one workstream, shared owners.
    - This is also how Current AI demonstrates the orchestrator role. If the coordination tool is broken, the claim is hollow.