# Data Model v2 — Designer Handoff

**Date:** 2026-04-30
**Status:** Ready for integration

---

## Data Model

Three concepts:

```
Stack (layers → categories)  →  what part of the AI stack
Entities                     →  who builds it
Products                     →  what they built
```

Every product has a `category_id` (where it sits in the stack) and an `entity_id` (who made it). Entities don't belong to categories — they appear in categories through their products.

---

## Files

All files live in `app/public/data/`. Fetch at runtime via `/data/<filename>`.

### Dimensions

| File | Records | Size | Description |
|---|---|---|---|
| `layers.json` | 8 | 15K | OSAI stack layers with nested category summaries |
| `categories.json` | 42 | 58K | Subcategories: gap scores, parity verdicts, 10-dimension ratings, synonyms, freshness dates |
| `entities.json` | 11,031 | 2.9M | Who — OSSD projects, GitHub orgs, closed-source entities |

### Fact table

| File | Records | Size | Description |
|---|---|---|---|
| `products.json` | 24,729 | 5.8M | Every product with common fields |

### Attribute tables (join via `product_id`)

| File | Records | Size | Description |
|---|---|---|---|
| `repos_attrs.json` | 15,375 | 5.2M | Stars, language, license, country, activity metrics |
| `models_attrs.json` | 6,349 | 1.4M | Downloads, pipeline_tag, benchmarks |
| `packages_attrs.json` | 2,818 | 452K | Package source, name |
| `contributions_attrs.json` | 165 | 78K | Artifact kind, significance, aliases, metrics, evidence, lineage |

### Lookups

| File | Records | Size | Description |
|---|---|---|---|
| `sparklines.json` | 5,623 | 624K | Star/fork time-series, keyed by repo slug |
| `crosswalk.json` | 113 | 25K | Old ecosystem taxonomy → OSAI category mapping (provenance) |

---

## Schemas

### `products.json` — the core fact table

Every product has exactly these 7 fields:

```jsonc
{
  "product_id": "repo:pytorch/pytorch",     // unique — prefixed with repo:, model:, pkg: for those types
  "product_type": "repo",                    // see product_type enum below
  "entity_id": "pytorch",                    // FK → entities.json
  "category_id": "infrastructure.ml_frameworks",  // FK → categories.json
  "display_name": "pytorch",
  "is_open": true,
  "url": "https://github.com/pytorch/pytorch"
}
```

**`product_type` enum:**

| Type | Count | Source | Example |
|---|---|---|---|
| `repo` | 15,380 | GitHub via warehouse | pytorch/pytorch |
| `model` | 6,383 | HuggingFace + curated open models | google/gemma-2-27b, Llama 3.1 |
| `package` | 2,818 | Package registries | torch (PyPI) |
| `model_closed` | 22 | Curated | GPT-4o, Claude Opus 4 |
| `service` | 27 | Curated | OpenAI API, ChatGPT, LangSmith |
| `chip` | 16 | Curated | NVIDIA H100, TPU v6e |
| `standard` | 11 | Curated | NIST AI RMF, Croissant |
| `policy` | 9 | Curated | EU AI Act, Llama License |
| `dataset` | 8 | Curated | MMLU, Cosmopedia |
| `dataset_closed` | 7 | Curated | OpenAI pretraining corpus |
| `eval_harness` | 5 | Curated | Chatbot Arena, MLPerf |
| `runtime` | 5 | Curated | CUDA, ROCm |
| `paper` | 3 | Curated | Constitutional AI, InstructGPT |
| `tool` | 2 | Curated | GitHub Copilot, Cursor |

### `entities.json`

```jsonc
{
  "entity_id": "pytorch",                   // join key
  "display_name": "PyTorch Foundation",
  "source": "ossd",                          // ossd | github | curated
  "type": "org",                             // org | company | individual | standards_body | academic_lab
  "country": "USA",
  "is_open_source_native": true,
  "homepage": "https://pytorch.org",
  "aliases": ["pytorch-foundation"],         // search tokens, GitHub org names
  "description": null                        // nullable, populated from upstream when available
}
```

Entity sources:
- **ossd** (151): OSSD-tracked projects — canonical, may span multiple GitHub orgs
- **github** (10,821): GitHub orgs with repos in our corpus but not in OSSD
- **curated** (59): Closed-source companies, standards bodies, academic labs with no GitHub presence

### `categories.json`

```jsonc
{
  "id": "infrastructure.hardware_chips",     // join key
  "layer_id": "infrastructure",              // FK → layers.json
  "display_name": "Hardware Chips",
  "description": "AI-specific chips and accelerators...",
  "is_dataset_blind_spot": true,

  // Parity story
  "parity_verdict": "closed_leads",          // unique_to_oss | competitive | closed_leads
  "gap_score": 2,                            // 0–5, lower = bigger gap
  "parity_rationale": "Hardware is inherently proprietary...",
  "parity_sources": [{ "url": "...", "label": "...", "date": "..." }],

  // Freshness
  "last_audited": "2026-04-29",
  "verdict_date": "2026-04-29",

  // Search
  "synonyms": ["GPU", "TPU", "silicon", "accelerator"],

  // 10-dimension maturity scores (1–5 each)
  "scores": {
    "breadth": 3, "production_readiness": 2, "ease_of_adoption": 2,
    "documentation": 3, "community_activity": 3, "performance_vs_closed": 1,
    "enterprise_readiness": 2, "interoperability": 2, "sustainability": 3,
    "standardization": 2
  },
  "criteria_avg": 2.3,
  "maturity": "Early stage"
}
```

### `layers.json`

```jsonc
{
  "id": "infrastructure",
  "display_name": "Infrastructure",
  "description": "...",
  "sort_order": 1,
  "categories": [
    { "id": "infrastructure.cloud_compute", "display_name": "Cloud Compute",
      "gap_score": 3, "parity_verdict": "competitive", "maturity": "Viable",
      "open_contributions": 454, "closed_contributions": 0, "repo_count": 451 }
  ]
}
```

### Attribute tables

**`repos_attrs.json`** — join on `product_id`:
```jsonc
{ "product_id": "repo:pytorch/pytorch", "stars": 87000, "language": "Python",
  "license": "BSD-3-Clause", "country": "USA", "description": "...",
  "stars_90d": 1200, "forks_90d": 800, "commits_90d": 3000,
  "total_contributors": 4000, "full_time": 200, "part_time": 3800 }
```

**`models_attrs.json`** — join on `product_id`:
```jsonc
{ "product_id": "model:google/gemma-2-27b", "repo": "google/gemma",
  "pipeline_tag": "text-generation", "library_name": "transformers",
  "downloads": 500000, "likes": 200, "model_family": null, "benchmark_avg": null }
```

**`packages_attrs.json`** — join on `product_id`:
```jsonc
{ "product_id": "pkg:PYPI:torch", "repo": "pytorch/pytorch",
  "package_source": "PYPI", "package_name": "torch" }
```

**`contributions_attrs.json`** — join on `product_id`:
```jsonc
{ "product_id": "ch_h100", "artifact_kind": "chip",
  "artifact_ref": "nvidia/h100", "significance": 5,
  "evidence_url": "https://...", "evidence_date": "2023-03-21",
  "notes": "Dominant training/inference GPU",
  "aliases": ["hopper", "nvidia-h100"],
  "metrics": { "memory_gb": 80, "fp16_tflops": 989, "tdp_watts": 700, "process_node": "4nm" },
  "repo_ref": null, "secondary_entity_ids": [],
  "base_model_contribution_id": null, "finetuned_from_contribution_id": null }
```

**`sparklines.json`** — keyed by repo slug (without `repo:` prefix):
```jsonc
{ "pytorch/pytorch": { "stars": [120, 95, 110, 130], "forks": [40, 35, 38, 42], "contributors": [] } }
```

---

## Join Keys

```
layers.id
  ↑
categories.layer_id
categories.id ←──── products.category_id

entities.entity_id ← products.entity_id

products.product_id ← repos_attrs.product_id
                    ← models_attrs.product_id
                    ← packages_attrs.product_id
                    ← contributions_attrs.product_id

repos slug ←──────── sparklines keys (strip "repo:" prefix)
```

---

## Verification Checklist

### Counts

- [ ] 8 layers, ordered: Infrastructure, Model Code, Model Datasets, Model Weights, Product/UX, Documentation, Licensing, Safeguards
- [ ] 42 categories: Infrastructure (7), Model Code (6), Model Datasets (5), Model Weights (5), Product/UX (6), Documentation (4), Licensing (4), Safeguards (5)
- [ ] 11,031 entities
- [ ] 24,729 products
- [ ] 15,375 repos_attrs, 6,349 models_attrs, 2,818 packages_attrs, 165 contributions_attrs
- [ ] 0 categories with zero products

### FK integrity

- [ ] Every `products.entity_id` resolves to an entity
- [ ] Every `products.category_id` resolves to a category
- [ ] Every `repos_attrs.product_id` exists in products
- [ ] Every `models_attrs.product_id` exists in products
- [ ] Every `packages_attrs.product_id` exists in products
- [ ] Every `contributions_attrs.product_id` exists in products

### Parity story

- [ ] 17 categories verdict `competitive`, 24 `closed_leads`, 1 `competitive` (preference alignment — editorially noted as unique to OSS but open datasets not yet cataloged)
- [ ] Every `closed_leads` category has at least 1 closed product
- [ ] `infrastructure.hardware_chips`: 0 open, 16 closed (chips from NVIDIA, Google, AMD, Intel, etc.)
- [ ] `infrastructure.ml_frameworks`: 559 open, 0 closed (PyTorch, JAX, TensorFlow)

### Spot checks

- [ ] `paperclipai/paperclip` → `product_ux.orchestration_agents` (not cloud_compute)
- [ ] `NVIDIA H100` → `infrastructure.hardware_chips`, `is_open: false`, `metrics.memory_gb: 80`
- [ ] `Claude Opus 4` → `model_weights.base_pretrained`, `is_open: false`, aliases include `"opus"`
- [ ] `Llama 3.1 405B` → `model_weights.base_pretrained`, `is_open: true`
- [ ] `pytorch` entity → `source: "ossd"`, `type: "org"`, `country: "USA"`
- [ ] `EU AI Act` → `safeguards.governance`, `product_type: "policy"`

### Search index tokens

Build from `entities.aliases + display_name`, `categories.synonyms + display_name`, `contributions_attrs.aliases`:

| Query | Expected hit |
|---|---|
| `opus` | Claude Opus 4 (contribution alias) |
| `cuda` | CUDA (contribution) |
| `h100` | NVIDIA H100 (contribution alias) |
| `gpu` | Hardware Chips (category synonym) |
| `llama` | Llama 3.1, Llama 3.3, Llama Guard, Meta (entity alias) |
| `pytorch` | PyTorch Foundation (entity) |
| `eu ai act` | EU AI Act (contribution) |
| `swe-bench` | SWE-bench (contribution alias) |

---

## What changed from v1

1. **Single taxonomy** — 42 OSAI subcategories replace the old dual-taxonomy system (OSAI 8-layer + 106 ecosystem pairs). One `category_id` per product.

2. **Entities replace actors + projects** — unified identity table merging OSSD projects (151), GitHub orgs (10,821), and closed-source entities (59). No more separate `actors.json` or `projects.json`.

3. **Normalized product model** — single `products.json` fact table with 7 common fields. Type-specific attributes in separate `*_attrs.json` files joined by `product_id`.

4. **Closed-source coverage** — 165 curated contributions: closed models (GPT-4o, Claude, Gemini), chips (H100, TPU, MI300X), standards (NIST AI RMF, EU AI Act), services (OpenAI API, LangSmith), and policies.

5. **Category assignments audited** — ~172 high-star repos recategorized after systematic audit (e.g. llama.cpp moved from compilers to inference_code, Ollama from storage to inference_code, paperclip from cloud_compute to orchestration_agents).

6. **Deleted stale files** — `taxonomy.json` (57K 1:many rows), `actors.json`, `projects.json`, `projects_classified.json`, `explorer-data.json`, `data.js`.
