# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open Source AI Market Map for Current AI — an interactive visualization of the open-source AI ecosystem across 7 stack layers, with gap analysis (red spots) and a crowdsourced roadmap. Built for Open Source Observer (OSO) under `oso-external/`.

Three phases:
1. **Interactive visualization** — layered stack map with drill-down to projects
2. **Gap analysis** — heatmap overlay showing ecosystem health (healthy/fragile/gap)
3. **Crowdsourcing** — votable issues, project submissions, gap adoption

## Tech Stack

- **Website**: Vanilla JS + CSS, built with Vite (pnpm for package management)
- **Data (future)**: pyoso client → OSO data warehouse (Trino SQL)
- **Notebooks**: marimo (`.py` files) for data analysis
- **Fonts**: Fraunces (serif display), Inter (UI), JetBrains Mono (data)

## Commands

```bash
pnpm dev                         # start dev server (port 5173)
pnpm build                       # production build → dist/
pnpm preview                     # preview production build
```

## Architecture

- `index.html` — single-page app shell (topbar, masthead, toolbar, sections, drawer)
- `src/data.js` — curated dataset: 7 layers × ~4 categories each, ~80 projects, health scores, suggestions
- `src/app.js` — all rendering and interaction (stack/workflow/matrix views, drawer, search, voting, form)
- `src/style.css` — full design system with CSS custom properties (paper/ink palette, editorial typography)

### Design System

Palette uses CSS custom properties: `--paper` (warm off-white), `--ink` (deep brown-black), `--signal` (gap red), `--healthy` (teal), `--warm` (amber). Health thresholds: ≥70 = healthy, 45-69 = medium/fragile, <45 = gap.

### Views

Three switchable views via segmented control:
- **Stack** — 7 horizontal layer rows, each with category cells
- **Workflow** — sequential pipeline phases with step selector
- **Matrix** — 5-dimension openness scores per layer

## Environment

- `OSO_API_KEY` loaded automatically via direnv (per-project `.envrc`)
- OSO MCP connects via SSE to localhost:8000 with Bearer token in `.mcp.json`
