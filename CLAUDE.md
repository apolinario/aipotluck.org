# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open Source AI Market Map for Current AI — an interactive visualization of the open-source AI ecosystem across key stack layers, with gap analysis (red spots) and a crowdsourced roadmap.

Three phases:
1. **Interactive visualization** — layered stack map with drill-down to projects
2. **Gap analysis** — heatmap overlay showing ecosystem health (healthy/fragile/gap)
3. **Crowdsourcing** — votable issues, project submissions, gap adoption

## Tech Stack

- **Website** (`app/`): Vanilla JS + CSS, built with Vite (pnpm for package management)
- **Data**: pyoso client → OSO data warehouse (Trino SQL)
- **Notebooks** (`notebooks/`): marimo (`.py` files) for data analysis
- **Scripts** (`scripts/`): Python CLI tools for publishing and export
- **Fonts**: Fraunces (serif display), Inter (UI), JetBrains Mono (data)

## Commands

```bash
# Website
cd app && pnpm dev               # start dev server (port 5173)
cd app && pnpm build             # production build → app/dist/
cd app && pnpm preview           # preview production build

# Notebooks
uv run marimo edit notebooks/data_inventory.py   # edit interactively
uv run marimo run notebooks/oss_ai_trends.py     # run as app

# Scripts
uv run scripts/export_notebooks.py               # export all notebooks to HTML
```

## Architecture

- `app/` — self-contained Vite website (own package.json, pnpm)
  - `app/src/data.js` — curated dataset: 7 layers × ~4 categories each, ~80 projects, health scores
  - `app/src/app.js` — all rendering and interaction (stack/workflow/matrix views, drawer, search, voting)
  - `app/src/style.css` — design system with CSS custom properties (paper/ink palette, editorial typography)
- `notebooks/` — marimo notebooks for analysis (query OSO + local CSVs)
- `scripts/` — Python CLI tools (notebook export, data publishing)
- `data/` — raw external CSVs (OSAI gap map, etc.)
- `docs/` — specs (`specs/`), plans (`plans/`), session logs (`sessions/`), methodology (`analysis-router.md`, `catalog-gaps.md`, `guides/`)

### Design System

Palette uses CSS custom properties: `--paper` (warm off-white), `--ink` (deep brown-black), `--signal` (gap red), `--healthy` (teal), `--warm` (amber). Health thresholds: ≥70 = healthy, 45-69 = medium/fragile, <45 = gap.

### Data Sources

15 queryable tables in the `currentai` org. See `models/README.md` for the complete inventory (UDMs + static/bridge models), including schedules and each model's CSV/SQL source.

- **UDMs** (`currentai.ai_*`): cron-refreshed, SQL-defined models that power joins and derived metrics.
- **Static/bridge models** (`currentai.*` CSV uploads): GoodAI list repos, HF model↔repo links, OSAI gap scores, and OSAI↔GoodAI mapping bridges.
- **Public** `oso.*` tables: project registry + event/activity tables (query semantics and join recipes in `docs/guides/currentai-queries.md`).

**Also:** local `data/*.csv` files. See `docs/catalog-gaps.md` for known missing orgs/repos.

## Environment

- `OSO_API_KEY` loaded automatically via direnv (per-project `.envrc`)
- OSO MCP connects via SSE to localhost:8000 with Bearer token in `.mcp.json`

## Persona routing

This repo defines one local analysis persona skill:

### pyoso persona (read-only)

Use `pyoso-analyst` when you have an API key but **no MCP tooling access** and you must keep operations read-only.

Skill: `./.claude/skills/pyoso-analyst/SKILL.md`

### Common references

- Querying + transforms: `docs/guides/currentai-queries.md`
- Notebook workflows + style guide links: `docs/guides/currentai-notebooks.md`

If a request would require write access or MCP operations, explain what’s missing and escalate to OSO internal workflows.
