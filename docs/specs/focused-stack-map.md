# Focused Stack Map — Reverse-Engineering Open Codex

**Issue:** [OSO-2597](https://linear.app/kariba/issue/OSO-2597/focused-stack-map-models-2-layers-across-10-categories)
**Branch:** `carl/oso-2597-focused-stack-map-models-2-layers-across-10-categories`
**Parent:** OSO-2595 (Epic: POC Phase II — AI Potluck Launch)
**Date:** 2026-05-19

## Thesis

The potluck's "money shot" is a concrete answer to: **what would it take to build an open-source Codex?** Rather than auditing all 42 OSAI subcategories at equal depth, we focus on ~10 categories that trace the full vertical from foundation model to user-facing product. Each category gets thorough OSS + closed coverage with real metrics, and the result is designed for agent-maintained refresh.

Codex is a product, not a model — so the center of gravity sits higher in the stack than a pure model-centric view would suggest. 4 of the 10 categories are in the Product/UX layer.

## Target Categories

| # | Layer | Category | Role in Codex | Key OSS | Key Closed |
|---|---|---|---|---|---|
| 1 | Product/UX | **Orchestration Agents** | The core — agent loop, tool use, multi-step reasoning | SWE-agent, OpenHands, Aider, Claude Code | Codex, Devin, Cursor |
| 2 | Model Weights | **Base Pretrained** | Code-capable frontier model | Llama, DeepSeek-V3, Qwen, Mistral | GPT-4o, Claude, Gemini |
| 3 | Model Weights | **Finetuned Chat** | Instruction-tuned for agentic coding | DeepSeek-Coder, CodeLlama, StarCoder | GPT-4o, o3 |
| 4 | Model Code | **Inference Code** | Fast serving — latency matters in agent loops | vLLM, TGI, SGLang, llama.cpp | TensorRT-LLM, Azure AI |
| 5 | Model Code | **Finetuning Code** | Adapting models for code/agent tasks via PEFT/RL | TRL, Axolotl, LLaMA-Factory | — |
| 6 | Model Code | **Evaluation Code** | Benchmarking code generation quality | SWE-bench, HumanEval, BigCodeBench | — |
| 7 | Product/UX | **Deployment** | Sandboxed execution, containerization | E2B, Daytona, Firecracker, Modal | AWS Lambda, GCP Cloud Run |
| 8 | Product/UX | **UI & API** | Task queue, diff review, user-facing shell | Open WebUI, LobeChat, LibreChat | ChatGPT, Copilot Chat |
| 9 | Product/UX | **Telemetry Observability** | Agent run monitoring, debugging failures | LangSmith (OSS), Langfuse, Phoenix | Datadog LLM, Helicone |
| 10 | Model Datasets | **Benchmark Eval Data** | Code evaluation datasets that drive improvement | The Stack, StarCoderData, CodeSearchNet | — |

### What's NOT included (and why)

- **Infrastructure** (ML Frameworks, Compilers, Cloud Compute) — you're assembling from existing components, not building infra
- **Training Code, Pretraining Data** — you're fine-tuning, not pretraining from scratch
- **Documentation, Licensing, Safeguards** — important but not the product differentiator
- **Model Architecture, Supporting Libraries** — enabling layers, not the vertical itself

### Taxonomy gaps to flag

Things Codex needs that don't map cleanly to the OSAI 42-subcategory taxonomy:

- **Sandboxed code execution** — closest is Deployment, but deserves its own slot (Firecracker, E2B, Daytona)
- **Code retrieval / RAG** — not in the taxonomy; sitting between Orchestration and Supporting Libraries
- **Tool use protocols** — MCP, function calling; partially in Orchestration but distinct

These could become custom subcategories in our focused view, or callout boxes within the existing categories.

## Implementation

### Step 1 — Define the focused taxonomy (data only)

Create `data/focused_stack/taxonomy.json`:

```json
[
  {
    "id": "product_ux.orchestration_agents",
    "layer_id": "product_ux",
    "display_name": "Orchestration Agents",
    "codex_role": "The core — agent loop, tool use, multi-step reasoning",
    "exemplar_oss": ["SWE-agent", "OpenHands", "Aider", "Claude Code", "AutoCodeRover"],
    "exemplar_closed": ["Codex", "Devin", "Cursor Agent"],
    "gap_score": 3,
    "parity_verdict": "competitive"
  }
]
```

For each of the 10 categories:
- Carry over `gap_score`, `parity_verdict`, `description` from existing `categories.json`
- Add `codex_role` (one sentence: what this layer does in the Codex vertical)
- Add `exemplar_oss` (3-5 flagship projects, hand-picked) and `exemplar_closed` (1-3 counterparts)

Source exemplar lists by querying `currentai.scores.repos_summary` + `currentai.scores.taxonomy` for top repos per subcategory by stars. Cross-reference with the `osai_gap_map` for closed-AI counterparts.

### Step 2 — Curate closed-AI entries

Create `data/focused_stack/closed_entries.csv`:

```csv
category_id,name,type,url,description
product_ux.orchestration_agents,Codex,service,https://openai.com/codex,OpenAI cloud coding agent
product_ux.orchestration_agents,Devin,service,https://devin.ai,Cognition's autonomous developer
model_weights.base_pretrained,GPT-4o,model_closed,https://openai.com,OpenAI flagship multimodal model
model_code.inference_code,TensorRT-LLM,service,https://developer.nvidia.com,NVIDIA optimized LLM inference
product_ux.deployment,AWS Lambda,service,https://aws.amazon.com/lambda,Serverless compute
product_ux.ui_api,ChatGPT,service,https://chat.openai.com,OpenAI chat interface
product_ux.telemetry_observability,Datadog LLM Observability,service,https://datadoghq.com,Enterprise LLM monitoring
```

This is the one editorial input. An agent can maintain it once seeded but shouldn't auto-generate it.

### Step 3 — Build the enriched project dataset

Write `scripts/build_focused_stack.py` that:

1. Reads `taxonomy.json` for the 10 target categories
2. Queries `currentai.scores.repos_summary` via pyoso for each category's top N repos (sorted by stars, with 90d activity metrics)
3. Queries `currentai.entities.models` for HF models in those categories
4. Queries `currentai.entities.packages` for linked packages
5. Merges in closed entries from `closed_entries.csv`
6. Outputs `app/public/data/focused_stack.json`:

```json
{
  "generated_at": "2026-05-19T12:00:00Z",
  "thesis": "What would it take to build an open-source Codex?",
  "categories": [...],
  "products": [
    {
      "category_id": "product_ux.orchestration_agents",
      "product_id": "repo:SWE-agent/SWE-agent",
      "name": "SWE-agent",
      "type": "repo",
      "is_open": true,
      "url": "https://github.com/SWE-agent/SWE-agent",
      "description": "...",
      "license": "MIT",
      "stars": 15000,
      "stars_90d": 2500,
      "commits_90d": 340,
      "contributors": 85,
      "entity_id": "SWE-agent"
    }
  ]
}
```

Design for refresh:
- `--dry-run` flag prints what would change
- `generated_at` timestamp in output
- Only `taxonomy.json` + `closed_entries.csv` are hand-curated; everything else is derived from live queries

### Step 4 — Update the stack view

Modify the app to render focused categories:

- Add `focused_stack.json` fetch in `useExplorerData.js`
- Make the focused view the **default** Stacks view; add a "Show all 42 categories" toggle for the full taxonomy
- In `StacksView.jsx`: when focused mode is active, filter layers/categories to the focused set; render with richer project chips (stars badge + parity verdict dot)
- Add a "Product Vertical" header banner explaining the Codex thesis ("What would it take to build an open Codex?")
- Keep existing drawer, category detail, and product detail flows unchanged

### Step 5 — Document the refresh process

Add to `scripts/README.md`:

```bash
# Refresh focused stack data (agent-runnable):
uv run scripts/build_focused_stack.py

# Dry run (show what would change):
uv run scripts/build_focused_stack.py --dry-run
```

## Files

**New:**
- `data/focused_stack/taxonomy.json` — curated 10-category taxonomy
- `data/focused_stack/closed_entries.csv` — closed-AI counterparts
- `scripts/build_focused_stack.py` — data build script
- `app/public/data/focused_stack.json` — generated output

**Modified:**
- `app/src/explorer/useExplorerData.js` — add focused data fetch
- `app/src/components/explorer/StacksView.jsx` — focused mode toggle + rendering
- `app/src/components/explorer/ExplorerApp.jsx` — wire focused toggle, default to focused

## What NOT to do

- Don't restructure the existing 42-category data pipeline
- Don't change `products.json`, `categories.json`, or `layers.json`
- Don't build new SQL models — use existing `scores.*` and `entities.*` tables
- Don't touch the landing page, roadmap, or ecosystem cluster views

## Verification

- `cd app && pnpm dev` — stacks view defaults to 10 focused categories
- Each category shows 5-10 OSS projects + 1-3 closed counterparts with metrics
- "Show all" toggle reveals the full 42-category view
- Clicking a category opens the existing drawer
- `uv run scripts/build_focused_stack.py --dry-run` runs end-to-end
- Product vertical banner renders with the Codex thesis
