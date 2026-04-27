# Ecosystem Mapping — Architecture & Design

## Overview

Open Source AI Market Map for Current AI — an interactive visualization of the open-source AI ecosystem with gap analysis and a crowdsourced roadmap. Built as a data platform with three layers: notebooks for analysis, a data model backed by OSO, and a static website for presentation.

**Workstream priority:** Notebooks (C) → Data model (A) → Website (B), with documentation/skills growing alongside.

**Architecture:** Monorepo, dual-export. Notebooks query OSO + local CSVs, produce two outputs: (1) static JSON for the website at build time, (2) UDMs/static models pushed back to OSO for warehouse consumers.

## Project Structure

```
ecosystem-mapping/
├── app/                           # Website (Vite project, pnpm)
│   ├── index.html
│   ├── package.json
│   ├── public/                    # Static assets, exported notebook HTML
│   └── src/
│       ├── app.js                 # Rendering + interaction
│       ├── data.js                # Hand-curated (replaced by data.generated.js over time)
│       └── style.css              # Design system (CSS custom properties)
├── data/                          # Raw external CSVs
│   └── *.csv                      # e.g. OSAI gap map (41 subcats × 10 dimensions)
├── notebooks/                     # Marimo notebooks (analysis + publish)
│   ├── oss_ai_trends.py           # Developer activity, momentum, star velocity
│   ├── oss_ai_gaps.py             # Gap analysis, Current AI focus area mapping
│   └── data_inventory.py          # Reconcile all sources, coverage stats (new)
├── scripts/                       # Python CLI tools
│   ├── export_notebooks.py        # marimo export html → app/public/notebooks/
│   └── publish_data.py            # Notebook outputs → app/src/data.generated.js (future)
├── docs/                          # Specs, methodology
├── pyproject.toml                 # Python/uv (notebooks + scripts)
└── CLAUDE.md
```

Two package managers coexist: `pnpm` for `app/`, `uv` for everything else. They don't depend on each other.

## Data Sources

Four sources today, designed to grow:

| Source | Location | Type | Records |
|--------|----------|------|---------|
| GoodAI List (Chip) | `currentai.goodailist_repos.repos` | OSO static model | 14,729 repos, 8 categories, 284 subcategories |
| OSS Insights AI | `currentai.ossinsights_ai_collections.ossinsights_ai_collections` | OSO static model | 616 repos, 53 collections |
| OSAI gap map | `data/*.csv` | Local CSV | 41 subcategories, 10-dimension scores (1-5) |
| OSO public tables | `oso.*` | OSO warehouse | Projects, artifacts, developer metrics, events |

### Adding new data sources

Each new dataset follows one of two paths:

- **CSV**: Drop in `data/`, add a load cell in the relevant notebook, add an entry in the data inventory
- **OSO static model**: Ingest via OSO platform into `currentai.*`, query with three-part table name (`currentai.<dataset>.<table>`)

No shared Python library is needed. Notebooks are self-contained. If patterns repeat across 3+ notebooks, extract to a `scripts/` utility.

## Two Taxonomies

The ecosystem has two classification systems that remain separate lenses, not merged:

**GoodAI taxonomy** (quantitative lens)
- 8 top-level categories: Infrastructure, AI Engineering, Model Development, Applications, Models, Tutorials, Lists, Misc
- 284 subcategories with repo-level data (stars, forks, contributors, trends)
- Used by `oss_ai_trends.py` and `oss_ai_gaps.py` for quantitative analysis

**OSAI gap map taxonomy** (qualitative lens)
- 7 layers: Infrastructure, Model Components (Datasets/Code/Weights), Product/UX, Documentation, Licensing, Safeguards
- 41 subcategories scored on 10 dimensions: Breadth, Production Readiness, Ease of Adoption, Documentation, Community Activity, Performance vs Closed, Enterprise Readiness, Interoperability, Sustainability, Standardization
- Overall scores (1-4), maturity labels, parity verdicts

They join at the repo level where possible but category structures are not reconciled.

## Notebooks

### `data_inventory.py` (new — build first)

Reconcile all data sources into a unified view:
- Load every available source (goodailist, ossinsights, OSAI gap map scores, future CSVs and static models)
- For each repo: which sources mention it, what metadata is available, what's missing
- Output: coverage stats, overlap matrix, unmatched repos per source
- A sources registry cell at the top lists all known sources with type and location

### `oss_ai_trends.py` (existing)

Quantitative analysis of developer activity and momentum:
- Queries goodailist repos joined against OSO developer metrics (stars, forks, contributors via OpenDevData)
- Monthly active devs by category, 7-day star velocity, top repos, FT/PT contributor breakdown
- No changes needed now

### `oss_ai_gaps.py` (existing)

Gap analysis against Current AI's 10 program areas:
- Health scatter (4 quadrants: gap priority, sustainability risk, hidden gems, healthy)
- Red spots table with composite gap score
- Hand-curated `FOCUS_MAPPING` from (category, subcat) → Current AI focus area
- Future: incorporate OSAI gap map qualitative scores as a second assessment lens

## Website

### Current state

Working prototype in `app/` — vanilla JS + CSS, built with Vite. Three views (Stack, Workflow, Matrix), gap heatmap, detail drawer, crowdsourced roadmap section. Hand-curated data in `src/data.js`.

### Design system

CSS custom properties: `--paper` (warm off-white), `--ink` (deep brown-black), `--signal` (gap red), `--healthy` (teal), `--warm` (amber). Fonts: Fraunces (serif display), Inter (UI), JetBrains Mono (data). Health thresholds: ≥70 healthy, 45-69 fragile, <45 gap.

### Evolution path

1. **Now:** Website stays as-is with hand-curated data. Useful for demos.
2. **After data inventory:** `scripts/publish_data.py` generates `app/src/data.generated.js` from notebook outputs, matching the existing `MARKET_MAP_DATA` shape. Health scores blend OSAI gap map qualitative + GoodAI/OSO quantitative.
3. **Later:** Switchable taxonomy lenses on the website, exported notebook HTML served at `app/public/notebooks/`, crowdsource section connected to real backend.

The website remains a static Vite build throughout — no server runtime, no live API calls. Editorial choices (layer structure, framing, copy) stay in website code.

## Data Flow

```
External CSVs (data/)     OSO Warehouse (currentai.*, oso.*)
        │                              │
        └──────────┐  ┌────────────────┘
                   ▼  ▼
              notebooks/
              (query, join, score, analyze)
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
     app/src/   UDMs back   docs/
     data.js    to OSO      methodology
     (JSON)     (optional)
```

One-way flow: raw data → notebooks → website + OSO. Notebooks are the single authoritative source for all computed data.

## Commands

```bash
# Website
cd app && pnpm dev              # dev server (port 5173)
cd app && pnpm build            # production build → app/dist/

# Notebooks
uv run marimo edit notebooks/data_inventory.py    # interactive editing
uv run marimo run notebooks/oss_ai_trends.py      # run as app

# Scripts
uv run scripts/export_notebooks.py                # export all to HTML
uv run scripts/export_notebooks.py oss_ai_gaps.py # export one
```

## What's Next

1. Restructure repo to match this design (move website into `app/`, add `pyproject.toml`, `scripts/`)
2. Build `data_inventory.py` notebook — reconcile all four sources
3. Iterate on existing notebooks with richer data
4. Build `publish_data.py` to bridge notebooks → website
