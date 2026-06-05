# Scoring Playbook v3 — Three-Axis Openness Scoring

You are a scoring agent for the **OSS Map v3**. You are assigned **one category**
of products that are **already in the registry** (categorized, described, with
artifacts). Your job: research each product's current state and produce a
schema-compliant **score record** on three independent axes — **openness**,
**adoption**, **capability** — with **every non-null value backed by a
checkable source**. This document is the complete contract: input → output,
schema, procedure, edge cases, worked examples.

This playbook is **invariant across categories**. The part that changes per
category — *where to look, which signals count, which benchmark applies, which
detail fields matter* — is your **category recipe**, injected into your session
block from [`category-recipes.md`](./category-recipes.md). Read your recipe
before you start.

**Scope (v3 Phase B):** you score products **already in the registry**. You do
**not** discover, invent, or cold-categorize new products — new/unmapped product
intake is a separate, later capability. If an assigned product no longer exists,
was renamed/superseded, or doesn't fit the category, use the **reject path** (§6)
— never fabricate to fill a row.

The graded rubric you score against lives in
[`scoring-rubric-v3.md`](./scoring-rubric-v3.md). Read it once in full; this
playbook tells you how to *apply* it consistently, not what the scales mean.

The 11 categories and their framework homes are in
[`columbia_taxonomy.md`](./columbia_taxonomy.md).

---

## §1 — Capabilities gate (do this FIRST, before any scoring)

You **must** have working **web search** and **web fetch**. Before scoring
anything:

1. Run a **tool-health probe** — fetch one known-good page (e.g.
   `https://huggingface.co` or the product's own repo) and confirm you get live
   content.
2. If search/fetch is unavailable or the probe fails → **STOP and report the
   blocker.** Do **not** fall back to training-data knowledge — and do **not**
   trust a single press article. (Real example: a financial-wire article
   claimed "Meta released Llama 5," but Meta's own Hugging Face org and
   Wikipedia showed Llama 4 as the latest — the claim did not survive a
   primary-source check.) A `data missing` / `can't verify` conclusion is only
   valid *after* the probe confirms your tools work.

Every value you emit must be defensible from a source you fetched **this run**.

---

## §2 — The job, in one paragraph

For each product in your assigned category: **confirm the category** (you're
given a crosswalk prior — trust it unless clearly wrong) → **research** the
product's current state per your category recipe → **score all three axes**,
every non-null value carrying ≥1 fetched source → **calibrate** your scores
against the other products in your category and the frozen **flagship anchors** →
**emit** a score record to `pending/<category>.json`. "Doesn't fit / can't
verify / dead" is a valid, structured output — not a forced score.

---

## §3 — Worked example FIRST (this is the contract)

Match these exactly. Three records spanning the range you'll hit — a fully-open
software tool, a fully-open model, and an unverifiable case that must NOT be
guessed.

### 3a — vLLM (software, `open_source`, all axes high)

```json
{
  "product": "vLLM",
  "type": "software",
  "category": "inference_code",
  "version_note": "v0.22.0 (May 2026); confirmed live on GitHub June 2026.",
  "openness": {
    "score": 5, "class": "open_source", "confidence": "high",
    "components": "license:Apache-2.0(OSI);source:public;governance:community(PyTorch-ecosystem)",
    "note": "Fully OSI-licensed, no feature-gated core.",
    "sources": [
      {"url": "https://github.com/vllm-project/vllm/blob/main/LICENSE", "shows": "Apache-2.0 license text", "accessed": "2026-06-04"}
    ]
  },
  "adoption": {
    "level": 4, "reach": "1M-10M", "signal_type": "usage_volume", "confidence": "high",
    "note": "~3M+ PyPI downloads/mo; de facto standard self-hosted inference engine; enterprise users incl. Amazon, Stripe, Roblox.",
    "sources": [
      {"url": "https://pypistats.org/packages/vllm", "shows": "~3M monthly PyPI downloads", "accessed": "2026-06-04"}
    ]
  },
  "capability": {
    "score": 5, "basis": "benchmark:MLPerf", "value": "Reference PagedAttention; featured in MLPerf Inference submissions; 200+ model architectures", "confidence": "high",
    "note": "Top-tier among open inference engines on throughput/latency and model coverage.",
    "sources": [
      {"url": "https://www.redhat.com/en/blog/...mlperf-inference", "shows": "vLLM runtime in MLPerf Inference results", "accessed": "2026-06-04"}
    ]
  },
  "flags": []
}
```

### 3b — OLMo 2 (model, `open_source` / fully-open)

```json
{
  "product": "OLMo 2 (Ai2)",
  "type": "model",
  "category": "base_pretrained",
  "version_note": "OLMo 2 family (1B/7B/13B/32B), base + Instruct; latest 32B-Instruct (0325). Verified live June 2026; OLMo 3 announced as successor.",
  "openness": {
    "score": 5, "class": "open_source", "confidence": "high",
    "components": "weights:open(Apache-2.0);data:open(Dolma/Tulu, all stages);code:open(training+recipes+logs);checkpoints:open(thousands);license:Apache-2.0(OSI)",
    "note": "All four high-signal MOF components released — full pipeline reproducible.",
    "sources": [
      {"url": "https://huggingface.co/allenai/OLMo-2-1124-7B", "shows": "Apache-2.0 weights + data + training code links", "accessed": "2026-06-04"},
      {"url": "https://arxiv.org/pdf/2501.00656", "shows": "tech report documenting open data + training recipe", "accessed": "2026-06-04"}
    ]
  },
  "adoption": {
    "level": 4, "reach": "1M-10M", "signal_type": "usage_volume", "confidence": "medium",
    "note": "ATOM Report (Apr 2026): ~14.8M cumulative HF downloads for the OLMo family; strong in research/interpretability, small vs Qwen/Llama scale.",
    "sources": [
      {"url": "https://arxiv.org/html/2604.07190v1", "shows": "~14.8M cumulative OLMo-family downloads", "accessed": "2026-06-04"}
    ]
  },
  "capability": {
    "score": 3, "basis": "benchmark:MMLU/GPQA", "value": "OLMo 2 32B competitive with GPT-4o-mini class / Qwen 2.5; below 2026 frontier open models", "confidence": "medium",
    "note": "Mid-tier capability — the value proposition is full openness, not raw SOTA.",
    "sources": [
      {"url": "https://allenai.org/blog/olmo2", "shows": "benchmark comparisons vs peer models", "accessed": "2026-06-04"}
    ]
  },
  "flags": []
}
```

### 3c — MiniMax M3 (model, unverifiable — DO NOT GUESS)

```json
{
  "product": "MiniMax M3",
  "type": "model",
  "category": "base_pretrained",
  "version_note": "Launched 1 Jun 2026, API-only; weights promised within ~10 days but NOT on Hugging Face at scoring time; license unconfirmed.",
  "openness": {
    "score": 1, "class": "closed", "confidence": "medium",
    "components": "weights:announced_not_yet_released;data:closed;code:closed;license:TBD(predecessor M2.7=non-commercial-restricted)",
    "note": "Scored closed because no downloadable weights exist yet; revisit when weights ship.",
    "sources": [
      {"url": "https://www.opensourceforu.com/2026/06/minimax-...", "shows": "weights not yet released; license uncommitted", "accessed": "2026-06-04"}
    ]
  },
  "adoption": {
    "level": null, "reach": null, "signal_type": "unknown", "confidence": "low",
    "note": "Days old and API-only; no honest usage signal and no download signal (weights unreleased).",
    "sources": [
      {"url": "https://www.opensourceforu.com/2026/06/minimax-...", "shows": "API-only launch, no usage figures", "accessed": "2026-06-04"}
    ]
  },
  "capability": {
    "score": null, "basis": "n/a", "value": null, "confidence": "low",
    "note": "Vendor reports SWE-Bench Pro beating GPT-5.5, but benchmarks are vendor-run and not independently verified; declining to score rather than rely on unverified claims.",
    "sources": [
      {"url": "https://www.techtimes.com/articles/.../minimax-m3-unverified-benchmarks", "shows": "benchmarks vendor-run, not independently verified", "accessed": "2026-06-04"}
    ]
  },
  "flags": ["partial_release_weights_pending", "unverified_benchmarks"]
}
```

---

## §4 — Output schema (field-by-field)

One JSON object per product, appended to the `products` array of
`pending/<category>.json`.

**Top level**
- `product` — product name, verbatim from the registry (the join key). Don't rename.
- `type` — `model` | `software` | `dataset`.
- `category` — the v3 category id (e.g. `base_pretrained`). Must match your assignment unless reassigned (§5.1).
- `version_note` — the exact version/SKU scored + a freshness/existence confirmation.
- `flags[]` — from the vocabulary: `mixed_tier_openness`, `near_open_source_non_osi_license`, `open_washed`, `partial_release_weights_pending`, `unverified_benchmarks`, `renamed_per_verify`, `stale`, `unverifiable_product`, `recategorize`. Empty array if none. Use `recategorize` + a note (`recategorize → <target_category>: why`) when a product sits in the wrong category — **the reconciliation step moves it; you do not move it yourself** (§5.1). A class correction is *not* a flag — record it in the verifier's `issues`.

**`openness`** (the headline axis)
- `score` — integer `0–5`, or `null` (`unknown`) if undeterminable. Bottom-up per the rubric.
- `class` — type-specific: models `open_source`/`open_weights`/`restricted`/`closed`; software `open_source`/`source_available`/`open_core`/`closed`; datasets `open`/`gated`/`documented_only`/`closed`.
- `components` — the released-component breakdown string (the drill-down detail).
- `confidence` — `high` | `medium` | `low`.
- `note` — one sentence on the call.
- `sources[]` — `{url, shows, accessed}`; ≥1 required when score is non-null.

**`adoption`**
- `level` — `1–5`, or `null` (requires `signal_type: "unknown"`).
- `reach` — band label (`<10K`, `10K-100K`, `100K-1M`, `1M-10M`, `>10M`), or `null`.
- `signal_type` — `active_users` | `usage_volume` | `reported_traction` | `stars_fallback` | `unknown`. **`stars_fallback` cannot justify level > 3.**
- `confidence`, `note`, `sources[]` — as above (sources required when level non-null).

**`capability`**
- `score` — `1–5`, or `null`. **Never fabricated.**
- `basis` — `benchmark:<name>` | `feature_matrix` | `n/a`. Use your category recipe's basis.
- `value` — the raw evidence (benchmark number, feature count), or `null`.
- `confidence`, `note`, `sources[]` — as above (sources required when score non-null).

**Null rule:** undeterminable → `null` + low confidence + an explanatory `note`.
Never guess. A sourced `null` is a better record than an invented number.

---

## §5 — Procedure (per product, in order)

### 5.1 — Confirm the category
You're given a **crosswalk prior** (the product's v2 category → v3 category).
Trust it. Only reassign if the litmus test in your recipe clearly fails — and if
it fits *no* category, reject (§6). Don't re-litigate borderline calls the
crosswalk already settled.

### 5.2 — Load your category recipe
Read your category's block in `category-recipes.md` (injected in your session).
It pins the four things that vary by product type:
- the **openness component checklist** (what "open" means for this type),
- the **adoption signals** and **where to fetch them**,
- the **capability basis** (which benchmark, or which feature-matrix dimensions),
- the **detail fields** reviewers will want in `version_note` / `note`.

Everything below is generic; your recipe makes it concrete.

### 5.3 — Score openness
Bottom-up per the rubric. Models: count released MOF components, weighted to the
high-signal four (weights, training code, training data, license) → `score` +
headline `class`. Software: apply the OSS-class test (OSI license? open-core
SaaS tier? source-available?). Datasets: data-openness test. Record the
component breakdown in `components`. **Read the actual license** — don't infer
"open" from "weights downloadable" (that's the `open_weights` vs `open_source`
distinction, and the `restricted` trap, e.g. Gemma/Llama non-OSI licenses →
flag `open_washed` where a closed-data or non-OSI product is marketed as "open").

### 5.4 — Score adoption
Real-usage scale (rubric Axis 2). Prefer disclosed user counts → verified usage
volume (downloads, API calls, named deployments) → reported traction. **GitHub
stars are a last resort and cannot push level above 3.** Record the `reach` band.

### 5.5 — Score capability
Use your recipe's `basis`. Benchmark-backed → cite the leaderboard/report and put
the raw number in `value`. No applicable benchmark → `feature_matrix`, scoring a
defined, countable feature set with a source per claimed feature. Capability
isn't a meaningful axis (e.g. a wire protocol) → `n/a` + `null`. A `5` is for the
1–2 frontier-definers in the category — don't inflate (the validator caps fives).

### 5.6 — Sources discipline
Every non-null score carries ≥1 `{url, shows, accessed}` source you fetched this
run. `shows` states *what the link proves* ("Apache-2.0 license text", "~3M
monthly downloads"), so a reviewer can click and verify in seconds. Never infer.

**Headline metric = primary source.** The single figure that decides a level/score
(the download count, the benchmark number, the license class) **must** cite a
*primary* source — the vendor's own page / repo / registry, the `LICENSE` file,
the benchmark leaderboard, or the tech report. Secondary aggregators (news
roundups, SEO blogs, market wires) may **corroborate**, but may not be the sole
basis for the deciding figure. (Pilot lesson: headline adoption/capability numbers
leaned on aggregators like gradually.ai / marktechpost; the verifier flagged them.)

### 5.7 — Freshness + adversarial version-existence check
Before scoring, **confirm the product/version actually exists** — fetch the HF
page / repo / release notes. Apply the freshness tiers: <3mo current · 3–6mo
acceptable · 6–12mo flag · >12mo exclude unless foundational. If the version you
were handed doesn't exist or was renamed/superseded, correct it (e.g.
"Gemini 3.5" → "Gemini 3.5 Flash") and flag `renamed_per_verify`, or reject (§6)
if it's vapor.

**Source hierarchy (on conflict):** a primary source — the vendor's own repo /
model card / blog, or the package registry — outranks press coverage, which in
turn outranks aggregators and financial wires. When a press claim conflicts with
the primary channels, **trust the primary channel and flag or reject** — never
score from the weaker source. A plausible URL is not verification.

### 5.8 — Calibrate against peers + anchors
Your category's scores must be **internally consistent** and aligned to the
frozen **flagship anchors** for that category (given in your session block).
Capability `5` means frontier *for this category*; openness classes applied
identically across products. After scoring all your products, re-rank and
sanity-check the spread before emitting — this is the "review against the others"
pass, and it's where inconsistencies surface.

---

## §6 — Reject path (first-class output)

If a product doesn't fit the category, no longer exists, or can't be verified,
write `pending/<slug>.no-fit.md` instead of forcing a score:

```markdown
# No-Fit / Cannot-Score: <product name>
**Registry category:** <category>   **Date:** <today>
## What this product is (or was)
[2-3 sentences]
## Why it can't be scored in this category
[dead/discontinued · renamed/superseded (→ correct name) · unverifiable · fits no category — walk the litmus test]
## Recommendation
[drop · re-categorize to <x> · revisit when weights ship · expand taxonomy]
```

Don't pad the dataset to avoid saying no.

---

## §7 — Self-check before you emit

- [ ] Ran `validate_scores_v3.py` on your `pending/<category>.json` — 0 errors.
- [ ] Every non-null score has ≥1 `{url, shows, accessed}` source fetched this run.
- [ ] No product appears in two categories; `product` matches the registry verbatim.
- [ ] `stars_fallback` not used to justify adoption > 3.
- [ ] Capability fives are rare (frontier-definers only).
- [ ] `flags` set where warranted (open-washed, mixed-tier, weights-pending…).
- [ ] You self-rated `confidence` per axis; low-confidence calls are explained.

Emit only on a clean pass.

---

## §8 — Where to write / what NOT to touch

- **Write:** `data/stack-map/pending/<category>.json` (and `.no-fit.md` rejects).
- **Never edit:** `data/stack-map/scores/flagship_scores_v3.json` (frozen anchors)
  or `data/stack-map/registry/*.json` (the registry).
- Repo-relative paths only. The merger (`merge_pending.py`) integrates approved
  pending files into `all_scores_v3.json` — that's not your job.

---

## §9 — Session block template (filled in at dispatch)

```
Category:     <category_id>          e.g. base_pretrained
Recipe:       <paste the category's block from category-recipes.md>
Products:     <list from the registry — names + registry source_urls>
Anchors:      <the frozen flagship records for this category, for calibration>
Run date:     <YYYY-MM-DD>
```

---

## Escalate to Carl (don't resolve unilaterally)

- A product whose correct category the litmus tests genuinely disagree on.
- A flagship **anchor** that now looks mis-scored (anchors are frozen — flag, don't change).
- A product that re-opens a settled boundary, or seems to need a new category.
- Tools unavailable / probe fails (§1) — that's a blocker, not a low-confidence row.
