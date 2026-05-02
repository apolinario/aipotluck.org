# Core roadmap

(Note: intro paragraphs are omitted in the website UI. Optional annotations on a step: `@ready_by:Q2 26`, `@owners:…`, `@label-color:…`, `@gap:red`, `@status:active|partial|gap`. Only the subtitle line renders in the UI. Lines prefaced by `@note` appear below the card. All other bullet points (`-`) are not rendered. Products are ordered by ready_by.)

The AI Potluck thesis is that the public-interest movement does not need a new model lab or new tech. It needs a coordinated suite of products assembled from the best open-source projects currently out there, hardened to consumer- and enterprise-grade, and put in the hands of users by the Swiss AI Summit. This roadmap names those products. Each product will then have a separate, more detailed technical roadmap that depends on the quality of the open-source components underneath.

If a closed-source company has produced a successful product, then a version of that product should be named here.

1. `chat` Browser-based conversational client. The product most users will judge the movement by. @gap:red @owners:Public AI @ready_by:Q2 26 @compare:claude.ai or chatgpt.com
   @note feels like Firefox-2005 today; needs to change by the Summit
   - chat.publicai.co exists with 42k registered users and is based on OpenWebUI. Basic features like file upload, web search, and tool calling already exist but are hampered by Apertus.
   - Account management features are poor, and the entire interface needs a refresh / may be too power-user oriented.
   - The world is also getting more agentic, and browser-based chat may be a thing of the past.

2. `stack-map` The live, public visualization of the open-source AI ecosystem. Meta-product essential for orchestration and coordination across the movement. @owners:Current AI + Mozilla + Hugging Face? @ready_by:Q2 26 @compare:LF AI & Data Landscape, Hugging Face leaderboards
   - Build data-first before commissioning design.
   - Related deliverables: G7 open source survey, Ayah's Columbia paper, and the live visualization of the stack map.

3. `inference-platform` Developer-facing API and portal with a core set of supported models, strong uptime guarantees, live status tracking, and other SLAs. @owners:Public AI @ready_by:Q2 26 @compare:Anthropic Console, OpenAI Platform
   - platform.publicai.co has simple billing and docs. Need better of each as well as uptime dashboards and SDKs.
   - Developer ergonomics are essential here, especially for agentic use-cases.

4. `inference-router` A distributed sovereign-inference layer that routes requests across the compute pool with low latency, optimized availability, strong failover, and provenance guarantees. @owners:Public AI + CSCS @ready_by:Q2 26 @compare:no clean analogue — closed labs run captive infra
   @note arguably the most defensible product in our stack
   - Need end-to-end observability across LiteLLM, AWS, and CSCS — prerequisite for SLAs and for helping CSCS hit 24/7 uptime.
   - Strong attestations that gov partners can verify. Already some work underway with Lucid.
   - Multi-model and multi-HPC routing positioned as "public + sovereign OpenRouter".

5. `foundation-model` The flagship open-source foundation model and model family. Needs multi-modal, tool-use, reasoning, and at least some use-case optimization. @gap:red @owners:Switzerland @ready_by:Q2 26 @compare:Claude Sonnet, GPT-4o
   - Apertus 1.5 (Q2 26) will have tool calling, vision, and longer context. Prerequisites for almost every product downstream.
   - Apertus 2 (EOY 26, large MoE) is the frontier-adjacent model. We NEED this by the Summit.
   - We can't fund pre-training directly, but we can fund and orchestrate the surrounding infra (data pipelines, fine-tuning recipes, eval harnesses, specific use-case dev).

6. `mobile-app` Native iOS and Android client. Where most consumer AI usage actually happens. @owners:Public AI @ready_by:Q3 26 @compare:Claude mobile, ChatGPT mobile
   - Most ChatGPT usage is mobile; we need everyone in Geneva 2027 to be walking around with our app on their phones.
   - iOS first, Android second.

7. `agent-service` A hosted service for deploying and configuring agents — ideally with evaluations, observability, auditing, and failsafes built in. @owners:community + Finland @ready_by:Q3 26 @compare:Microsoft Foundry Agent Service, Amazon Bedrock AgentCore, Anthropic Managed Agents
   - SafeMolt may be this already.

8. `skills` An open marketplace and authoring surface for reusable, composable model capabilities. @owners:community @ready_by:Q3 26 @compare:Anthropic Skills, OpenAI GPTs
   - An open version with wiki-style curation of ~20 skills could be a strong potluck play at the Summit. Ask partners to submit a skill.
   - This may be quite easy to do; almost a feature of chat. Famous last words…

9. `interviewer` An agentic AI interviewer for structured listening at scale. Signature public-interest product we can realistically do better than the closed labs. @owners:Change.org, CIP, Public AI @ready_by:Q3 26 @compare:Remesh, Polis, Anthropic Interviewer and Clio
   @note proves public-interest AI is a different category, not just a cheaper one
   - Synergizes directly with Switzerland's Dialogue Weeks and with the delibtech community Current AI is already adjacent to.
   - We need to convince interviewees to share things they wouldn't share with ChatGPT.

10. `desktop-app` Native macOS, Windows, and Linux client for power-users. Important for local-first features, including local/rare/personal data use-cases. @owners:community @ready_by:Q4 26 @compare:Claude Desktop, ChatGPT Desktop
    - Linux support is a small effort that signals seriousness to the open-source community. Closed labs ship Mac and Windows only.
    - Local model fallback (running Apertus 8B on-device when offline) could be a cool differentiator.

11. `benchmarks` Independent, reproducible benchmarks and evaluation suites for foundation models, agentic systems, and safety — published as a product, not a paper. @owners:Finland + civil society? @ready_by:Q4 26 @compare:HELM, UK AISI Inspect, MMLU leaderboards
    - Foundation model evals are a credibility instrument for backers and funders. Don't play OpenAI's benchmark game; change the game.
    - I would prioritize agentic evals before Q4. Being early here can be a moat for everything else.
    - Evals should be connected to our inference platform — evaluation people spend a lot on inference.

12. `trust-and-safety` Content moderation, incident response, T&C, and data governance so the stack is defensible on day one of public access. @gap:red @owners:Roost.tech, UK AISI @ready_by:Q4 26 @compare:no consumer-facing analogue — closed labs run this internally
    - Content moderation and abuse detection.
    - Published incident response and disclosure policy.
    - Take a sovereign, local approach to service governance (who decides what ships, who decides what's moderated). Ties with `interviewer`.

13. `edge` A hardware stack optimized for on-device AI. @owners:India + Current AI @ready_by:Q4 26 @compare:no consumer-facing analogue — closed labs structurally can't ship flagship models to devices they don't control
    @note The one layer where open-source is genuinely ahead of closed labs. Worth pressing the advantage!
    - We should definitely do something here, but the exact path (reference hardware vs. reference software stack vs. local-first desktop mode) needs a deliberate choice.

14. `coding-agent` A coding agent built on the open stack. @owners:community @ready_by:Q4 26 @compare:Claude Code, Codex, Cursor Agent
    - It's unclear whether we can use Apertus for this, or whether someone could fine-tune Apertus for this specific use-case.
    - It's going to be really hard to compete with Claude Code though.

15. `compute-supply` Pooled, multi-source compute that the rest of the stack runs on. Right now, we have enough from CSCS and pay for the rest. @owners:Finland (LUMI/CSC) + Switzerland (CSCS) + partner institutions @ready_by:Q1 27 @compare:no clean analogue — closed labs own captive datacenters
    @note Compute is the core contribution governments can most easily give.
    - The compute has to be high quality as well — we can't give people an experience 2x slower than Claude or OpenAI.
    - We will need private compute at some point, but can probably stick with HPCs until the Swiss AI Summit.
    - Would benefit from some research into distributed inference.
