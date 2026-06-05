# Category Recipes — per-category scoring guidance

The base [`scoring-playbook-v3.md`](./scoring-playbook-v3.md) is **invariant**: it
defines *how* to score and source. This file holds the part that **varies by
category** — *where to look, which signals count, which benchmark applies, and
which detail fields reviewers want*. At dispatch, the scoring agent's session
block gets **only its category's recipe** injected.

Each recipe pins four things:
1. **Litmus test** — confirm the product belongs here (the crosswalk prior is
   usually right; reassign only on a clear miss; no-fit → reject).
2. **Openness checklist** — what "open" means for this product type, and the
   class test (read the actual license; never infer from "weights downloadable").
3. **Adoption signals** — the real-usage evidence and where to fetch it
   (stars are last-resort, capped at level 3).
4. **Capability basis** — the benchmark to cite, or the feature-matrix dimensions.

Plus the **frozen flagship anchors** for the category — calibrate to these;
capability `5` means frontier *within this category*.

> All 11 category recipes are present. The three pilot recipes (base/pretrained,
> orchestration & agents, inference code) were calibrated on a live pilot run; the
> other eight are templated off them. `benchmark_eval_data` uses the **novel
> dataset-openness path** (untested in the pilot — mark confidence honestly).

---

## `base_pretrained` — Base / pretrained models  ·  layer: model weights  ·  type: model

**Litmus test.** "Can I download these weights and they have *not* been
instruction-tuned?" → here. Post-trained for chat/agent use → `finetuned_chat`.
Families that ship both base + instruct: score the base here, the instruct in
`finetuned_chat`. API-only proprietary models (no weights) are listed here as
their closed counterpart (class `closed`).

**Openness checklist (MOF, models).** Count released components, weighted to the
high-signal four — **weights, training data, training code, license**. Then the
component breakdown: architecture · parameters (final/intermediate checkpoints) ·
training code · inference code · data-preprocessing code · datasets · eval data ·
tech report · model/data cards · eval results. **Read the license:**
- `open_source` — OSI/open license **+ training code + training data** released (full pipeline reproducible). e.g. OLMo 2, Pythia.
- `open_weights` — weights downloadable under a usable/open license (MIT/Apache), but data and/or code closed. e.g. DeepSeek, Qwen, Mistral, GLM, Phi, Nemotron.
- `restricted` — weights available but under a **non-OSI / use-restricted** license (MAU caps, field-of-use limits). e.g. Llama (Community License), Gemma (Gemma License) → flag `open_washed` if marketed as "open".
- `closed` — no downloadable weights. e.g. GPT-5, Claude, Gemini, Grok.

**Adoption signals (where to fetch).** Hugging Face cumulative + 30-day downloads
(ATOM Report bands), number of derivative/fine-tuned models, multi-provider
serving (OpenRouter, Together, Fireworks, DeepInfra). For closed API/app models,
disclosed user counts of the surface they power (ChatGPT WAU, Gemini app MAU) →
`signal_type: active_users` (attribute honestly to the surface, not the SKU).
`usage_volume` for download-driven. Reach band required.

**Capability basis.** `benchmark:` — MMLU-Pro, GPQA Diamond, SWE-bench Verified,
LMArena Elo, AIME. Put the raw figure in `value`. Cite the tech report **and** an
independent leaderboard (Artificial Analysis, LMArena, llm-stats). A `5` = current
frontier; mid-2025 models that have been surpassed are `3`.

**Detail fields (`version_note`/`note`).** params + active (MoE), context window,
exact license name, release date, frontier-relative position, base-vs-instruct.

**Flagship anchors** (O = openness/class · A = adoption · C = capability):
OLMo 2 `O5 open_source / A4 / C3` · Pythia `O5 open_source / A3 / C1` · Llama 4 `O2 restricted / A4 / C3` · DeepSeek-V3.2 `O3 open_weights / A5 / C4` · DeepSeek-V4-Pro `O3 open_weights / A4 / C5` · Qwen 3.6 `O3 open_weights / A5 / C5` · Kimi K2.6 `O3 open_weights / A4 / C5` · Mistral Large 3 `O3 open_weights / A3 / C4` · Gemma 3 `O2 restricted / A5 / C3` · GLM-5.1 `O3 open_weights / A3 / C5` · Phi-4 `O3 open_weights / A4 / C3` · Falcon 3 `O2 restricted / A2 / C2` · Nemotron 3 `O4 open_weights / A3 / C5` · MiniMax M3 `O1 closed / A:null / C:null` · GPT-5 `O1 closed / A5 / C5` · Claude Opus 4.7 `O1 closed / A:null / C5` · Gemini 3.5 Flash `O1 closed / A5 / C5` · Grok 4.20 `O1 closed / A2 / C4`

---

## `orchestration_agents` — Orchestration & agents  ·  layer: system / Product-UX  ·  type: software

**Litmus test.** "Does this product take a goal and figure out the steps itself
(plan → call tools → iterate)?" → here. Presents model output in a UI but doesn't
autonomously act → `ui_api`. Serves a model without agent logic → `inference_code`.
A coding *agent* (OpenHands, Cursor agent mode) is here; a chat editor is `ui_api`.

**Openness checklist (OSS class, software).** Read the `LICENSE` **and** the
pricing page (open-core is invisible from the repo alone):
- `open_source` — OSI license (MIT/Apache/AGPL), full source public, no feature-gated core.
- `source_available` — source public but non-OSI (BSL/SSPL/custom).
- `open_core` — OSS core + proprietary managed/enterprise tier. e.g. OpenHands, CrewAI, LangChain (LangSmith).
- `closed` — proprietary / SaaS-only. e.g. Cursor, Devin, Claude Code.

**Adoption signals (where to fetch).** PyPI/npm monthly downloads, GitHub
dependents ("used by"), cumulative installs, named production deployments, agent-
execution counts; for closed products, disclosed paying-user counts. GitHub stars
are **last-resort only** (`stars_fallback`, cannot exceed level 3).

**Capability basis.** Autonomous coding agents → `benchmark:` SWE-bench Verified /
Terminal-Bench / GAIA (raw score in `value`). General agent frameworks/libraries
with no headline benchmark → `feature_matrix`: {autonomy, tool-use breadth,
multi-agent orchestration, model-agnosticism, eval/reliability tooling} — a source
per claimed feature.

**Detail fields.** framework vs product vs managed platform; managed/enterprise
tier present?; model-agnostic vs locked to one provider; integration breadth;
SWE-bench/GAIA number if any.

**Flagship anchors:** OpenHands `O4 open_core / A3 / C5` · CrewAI `O4 open_core / A4 / C3` · LangChain `O4 open_core / A5 / C4` · Dify `O3 source_available / A3 / C4`

---

## `inference_code` — Inference code  ·  layer: model code  ·  type: software

**Litmus test.** "Does this software load model weights and serve predictions
(generation/embeddings)?" → here. Runs arbitrary *user* code in a sandbox →
`deployment`. Routes across providers without doing inference itself → `ui_api`.

**Openness checklist (OSS class, software).** Read the `LICENSE`. Note: a
**vendor-hardware lock** (e.g. TensorRT-LLM is NVIDIA-GPU-only) is *not* a license
restriction — an Apache-licensed engine is still `open_source`, though the lock is
worth noting and may temper the score. Proprietary cloud inference engines
(Groq, Fireworks FireAttention, Together, Cerebras, cloud TPU/Neuron) → `closed`.
Open core (OSS engine + managed cloud) → `open_core`.

**Adoption signals (where to fetch).** PyPI monthly downloads, GitHub dependents,
named production users, monthly model pulls (Ollama), reported tokens/day or
GPU-fleet size (SGLang). `usage_volume` preferred; stars last-resort (≤3).

**Capability basis.** `benchmark:MLPerf` (Inference) where the engine appears in
submissions — throughput/latency on standard hardware, raw figure in `value`.
Engines without a standardized submission → `feature_matrix`: {model-architecture
coverage, quantization support, continuous batching, parallelism (TP/PP/EP),
hardware breadth} — source per feature.

**Detail fields.** open vs vendor-hardware-locked; managed-cloud tier; model
coverage count; MLPerf presence; latest release + date.

**Flagship anchors:** vLLM `O5 open_source / A4 / C5` · SGLang `O5 open_source / A4 / C5` · TensorRT-LLM `O4 open_source / A3 / C5`

---

## `finetuned_chat` — Fine-tuned / chat models  ·  layer: model weights  ·  type: model

**Litmus test.** "Were these weights post-trained for a downstream use (instruct / chat / RLHF / DPO / agentic)?" → here. Raw pretrained, no alignment step → `base_pretrained`. Families shipping both: base in `base_pretrained`, the instruct/chat SKU here. **This is where base-list miscategorizations land** (the pilot found GLM-4.6, Command R+ are instruct, not base) — flag `recategorize → finetuned_chat`.

**Openness checklist (MOF, models).** Same as base: count released MOF components, read the license → `open_source` / `open_weights` / `restricted` / `closed`. Post-training data/recipes (SFT/RLHF datasets) count toward openness here — open weights + undisclosed alignment data = `open_weights`.

**Adoption signals (where).** HF downloads (instruct variants often out-download base), provider/serving availability, app-surface user counts for closed assistants (`active_users`, attributed honestly). Reach band.

**Capability basis.** `benchmark:` — chat/agentic suites: LMArena Elo, MT-Bench, SWE-bench Verified, GPQA, AIME, MMLU-Pro. Raw figure in `value`; primary source.

**Detail fields.** post-training method (SFT/RLHF/DPO), params/MoE, context, license, release date, frontier position.

**Flagship anchors:** none — calibrate to the rubric and to the `base_pretrained` anchors' openness ladder (same model classes); mark `confidence` accordingly.

---

## `finetuning_code` — Fine-tuning code  ·  layer: model code  ·  type: software

**Litmus test.** "Does this software take existing weights and train/adapt them (full FT, LoRA, RLHF, DPO)?" → here. The resulting weights → `finetuned_chat`. Measures models without training → `evaluation_code`. General ML framework (PyTorch/JAX) → out of scope.

**Openness checklist (OSS class).** Read LICENSE + managed tier. `open_source` (OSI: TRL, Axolotl, Unsloth, Megatron-LM) / `source_available` / `open_core` (OSS lib + managed training SaaS) / `closed` (proprietary fine-tuning service).

**Adoption signals (where).** PyPI/conda downloads, GitHub dependents, named users (labs/companies training on it), HF Trainer/TRL integration. stars last-resort (≤3).

**Capability basis.** `benchmark:MLPerf-Training` where applicable (large-scale training libs); else `feature_matrix`: {methods (SFT/LoRA/QLoRA/DPO/PPO/GRPO), parallelism (TP/PP/DP/EP/CP), precision (BF16/FP8/FP4), demonstrated scale, hardware breadth}.

**Detail fields.** library vs platform; parallelism + precision; largest model/GPU-count demonstrated; managed tier.

**Flagship anchor:** Megatron-LM `O5 open_source / A3 / C5`.

---

## `evaluation_code` — Evaluation code  ·  layer: model code  ·  type: software

> Flagged Columbia **extension** (`model.code.evaluation`) — keep records but they carry the extension caveat.

**Litmus test.** "Does this software score a model/agent against a benchmark and produce results?" → here. The *dataset* it runs → `benchmark_eval_data`. Monitors production → `telemetry_observability`.

**Openness checklist (OSS class).** Read LICENSE. `open_source` (OSI: lm-evaluation-harness, OpenCompass, SWE-bench harness, DeepEval) / `source_available` / `open_core` (OSS harness + commercial eval cloud, e.g. Confident AI) / `closed` (proprietary eval platform).

**Adoption signals (where).** PyPI downloads, GitHub dependents, **"cited in N frontier model release reports"** (the top signal for a harness), leaderboard adoption. stars last-resort.

**Capability basis.** Usually `feature_matrix`: {benchmark/task coverage, model-backend breadth, reproducibility/standardization, agentic-eval support}. `n/a` where not meaningful.

**Detail fields.** task/benchmark coverage; de-facto-standard status (cited in releases); agent vs model eval; managed tier.

**Flagship anchors:** none — calibrate to the rubric; mark confidence.

---

## `deployment` — Deployment  ·  layer: system / Product-UX  ·  type: software

**Litmus test.** "Does this let an agent safely run arbitrary code it generated (sandbox / container / serverless)?" → here. Serves model *weights* → `inference_code`. (E2B, Modal sandbox = here; vLLM = inference.)

**Openness checklist (OSS class).** Read LICENSE + managed tier. `open_source` (OSI: Firecracker, gVisor, Ray) / `source_available` / `open_core` (OSS runtime + managed cloud: E2B, Modal) / `closed` (proprietary serverless — Lambda, Cloud Run as closed counterparts).

**Adoption signals (where).** SDK/PyPI downloads, named production users, GitHub dependents, sandbox-execution volume; closed → disclosed customer/usage figures. stars last-resort.

**Capability basis.** `feature_matrix`: {isolation strength (VM vs container vs process), cold-start latency, language/runtime breadth, persistence, scale}. `benchmark:` only where a standard exists.

**Detail fields.** isolation model; cold-start; managed vs self-host; language breadth.

**Flagship anchors:** Ray `O4 open_core / A4 / C4` · Ollama `O5 open_source / A4 / C4`.

---

## `ui_api` — UI & API  ·  layer: system / Product-UX  ·  type: software

**Litmus test.** "Is the human in the driver's seat using AI as a tool (chat UI), or is this routing/aggregating API calls to providers?" → here. AI autonomously pursuing a goal → `orchestration_agents`. Serves weights → `inference_code`.

**Openness checklist (OSS class).** Read LICENSE + managed tier. `open_source` (OSI: Open WebUI, LibreChat, LiteLLM core) / `source_available` / `open_core` (OSS + paid cloud/enterprise) / `closed` (OpenRouter, proprietary chat apps as closed counterparts).

**Adoption signals (where).** PyPI/npm/Docker pulls, GitHub dependents, hosted MAU (chat UIs), API request volume (gateways), named users. stars last-resort.

**Capability basis.** `feature_matrix` — gateways: {provider/model coverage, routing/fallback/load-balancing, cost tracking + budgets, auth/keys, OpenAI-compat}; chat UIs: {model breadth, RAG, multimodal, plugins, multi-user}.

**Detail fields.** gateway vs chat-UI; provider coverage count; managed tier; self-host story.

**Flagship anchor:** LiteLLM `O4 open_core / A3 / C4`.

---

## `telemetry_observability` — Telemetry & observability  ·  layer: system / Product-UX  ·  type: software

**Litmus test.** "Does this help understand what my LLM/agent system is doing in *production* (traces, cost, failures)?" → here. Offline benchmarking → `evaluation_code`. General APM (Datadog core) → out of scope.

**Openness checklist (OSS class).** Heavily open-core — read LICENSE + the enterprise/SaaS split. `open_source` (OSI: MLflow, Arize-Phoenix OSS) / `source_available` / `open_core` (OSS core + enterprise security/SaaS: Langfuse, Helicone) / `closed` (LangSmith, Galileo, Datadog LLM Obs).

**Adoption signals (where).** PyPI/npm/Docker pulls, GitHub dependents, named production users, OTel integration; closed → disclosed customers. stars last-resort.

**Capability basis.** `feature_matrix`: {tracing depth, prompt mgmt/versioning, evals (incl LLM-as-judge), datasets/annotation, cost tracking, OTel + framework integrations}.

**Detail fields.** what's OSS-core vs enterprise-gated; OTel support; eval features; integration breadth.

**Flagship anchors:** MLflow `O5 open_source / A4 / C4` · Langfuse `O4 open_core / A3 / C4`.

---

## `benchmark_eval_data` — Benchmark / eval datasets  ·  layer: model datasets  ·  type: dataset

> **Novel openness path** — the only `dataset`-type category; it uses the **data-openness** rubric, not MOF or OSS-class. Untested in the pilot — mark `confidence` honestly and flag ambiguity.

**Litmus test.** "Is the primary artifact a *collection* of examples/problems/code (a dataset)?" → here. Software that *runs* models against the data → `evaluation_code`. General pretraining corpus (Common Crawl, RedPajama) → out of scope.

**Openness checklist (DATA openness).** Classes: `open` (open data license — CDLA/CC/ODC — downloadable + datasheet; e.g. HumanEval, GSM8K) / `gated` (access-request / login-walled / partial) / `documented_only` (described in a paper, not redistributable) / `closed` (private / held-out test split — e.g. SWE-bench's hidden set, proprietary eval suites). Read the dataset license, check redistributability, and whether a datasheet/card exists.

**Adoption signals (where).** HF dataset downloads, **citation as a standard in frontier model release reports** (the top signal for a benchmark → `reported_traction`/`usage_volume`), leaderboard usage. stars last-resort.

**Capability basis.** Usually **`n/a`** — a dataset isn't "capable." Where a quality proxy is meaningful (discriminating power, contamination resistance) use `feature_matrix` sparingly; otherwise `null` + note. **Openness + adoption carry this category.**

**Detail fields.** size / task count; license + redistributability; datasheet present; held-out vs public; contamination status; is-it-a-standard.

**Flagship anchors:** none — calibrate to the rubric; mark confidence (novel path).

---

## `agent_tools_protocols` — Agent tools & protocols  ·  layer: system / Product-UX  ·  type: software

**Litmus test.** "Is this primarily *used by* an agent to interact with the world (search, browse, retrieve, or a tool protocol)?" → here. The thing that *does the calling/planning* → `orchestration_agents`. Serves weights → `inference_code`. Human-facing chat → `ui_api`. Sub-segments: search APIs (Tavily, Exa), browser/scrape (Browserbase, Firecrawl, Playwright MCP), retrieval/RAG infra (vector DBs), tool protocols (MCP, function-calling specs).

**Openness checklist (OSS class).** Read LICENSE + managed tier. `open_source` (OSI: Milvus, Qdrant core, MCP SDKs) / `source_available` / `open_core` (OSS + managed cloud: Qdrant Cloud, Firecrawl) / `closed` (proprietary search/scrape APIs — Tavily, Exa as closed counterparts). For a *protocol* (MCP), score the reference implementation/spec license.

**Adoption signals (where).** PyPI/npm/SDK downloads, API call volume, GitHub dependents, **native client/agent support breadth** (for protocols, # of clients adopting it — the MCP signal), named users. stars last-resort.

**Capability basis.** Vector DBs → `benchmark:ANN-Benchmarks` (recall/QPS/latency, raw in `value`). Search/scrape tools → `feature_matrix` {coverage, freshness, structured output, rate limits}. Wire protocols (MCP) → `n/a` + note (a protocol isn't benchmarked).

**Detail fields.** sub-segment; vector-DB ANN-bench numbers; protocol adoption breadth; managed tier.

**Flagship anchor:** Milvus `O5 open_source / A3 / C4`.
