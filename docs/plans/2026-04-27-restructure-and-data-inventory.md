# Restructure & Data Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo to match the architecture spec (website in `app/`, Python at root) and build the first data inventory notebook that reconciles all four data sources.

**Architecture:** Move the existing Vite website into `app/`, add a root `pyproject.toml` for Python work, then build `notebooks/data_inventory.py` — a marimo notebook that loads GoodAI List, OSS Insights, OSAI gap map CSV, and OSO public tables, showing coverage and overlap.

**Tech Stack:** Vite (pnpm), marimo (uv), pyoso, pandas, plotly

---

## File Structure

### Files to move
- `index.html` → `app/index.html`
- `src/app.js` → `app/src/app.js`
- `src/data.js` → `app/src/data.js`
- `src/style.css` → `app/src/style.css`
- `package.json` → `app/package.json`
- `pnpm-lock.yaml` → `app/pnpm-lock.yaml`

### Files to create
- `app/public/.gitkeep` — empty public assets directory
- `pyproject.toml` — Python project config (uv)
- `notebooks/data_inventory.py` — new marimo notebook
- `CLAUDE.md` — update to reflect new structure

### Files to delete
- `src/` directory (after move)
- Root `package.json` and `pnpm-lock.yaml` (after move)
- Root `index.html` (after move)

---

### Task 1: Move website into `app/`

**Files:**
- Move: `index.html` → `app/index.html`
- Move: `src/*` → `app/src/*`
- Move: `package.json` → `app/package.json`
- Move: `pnpm-lock.yaml` → `app/pnpm-lock.yaml`
- Create: `app/public/.gitkeep`

- [ ] **Step 1: Create app directory and move files**

```bash
mkdir -p app/public
git mv index.html app/index.html
git mv src app/src
git mv package.json app/package.json
git mv pnpm-lock.yaml app/pnpm-lock.yaml
touch app/public/.gitkeep
```

- [ ] **Step 2: Update the Vite module path in `app/index.html`**

The script tag currently points to `/src/app.js`. Since `src/` is now inside `app/`, the relative path stays the same but verify it works:

```html
<script type="module" src="/src/app.js"></script>
```

This path is correct — Vite resolves relative to `index.html`'s location. No change needed.

- [ ] **Step 3: Install dependencies and verify the dev server**

```bash
cd app && pnpm install && pnpm dev
```

Expected: Vite dev server starts on port 5173. Open `http://localhost:5173` — the market map renders with all three views (Stack, Workflow, Matrix), drawer opens on cell click, search works.

Stop the dev server after verifying.

- [ ] **Step 4: Commit**

```bash
git add app/ .gitignore
git commit -m "chore: move website into app/ subdirectory"
```

---

### Task 2: Add Python project config

**Files:**
- Create: `pyproject.toml`

- [ ] **Step 1: Create `pyproject.toml` at repo root**

```toml
[project]
name = "ecosystem-mapping"
version = "0.1.0"
description = "Open Source AI Market Map — data analysis and visualization"
requires-python = ">=3.11"
dependencies = [
    "marimo",
    "pyoso",
    "pandas",
    "plotly",
]

[project.optional-dependencies]
dev = [
    "ruff",
]
```

- [ ] **Step 2: Create the virtual environment and sync**

```bash
uv sync
```

Expected: Creates `.venv/` and installs marimo, pyoso, pandas, plotly.

- [ ] **Step 3: Verify marimo can check existing notebooks**

```bash
uv run marimo check notebooks/oss_ai_trends.py
uv run marimo check notebooks/oss_ai_gaps.py
```

Expected: Both pass with no cycle or import errors. (They won't execute the SQL — just structural validation.)

- [ ] **Step 4: Add `.venv/` to `.gitignore` if not already present**

Check `.gitignore` — it should already have `.venv/` from our earlier setup. Verify:

```bash
grep -q '.venv/' .gitignore && echo "already there" || echo ".venv/" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml uv.lock .gitignore
git commit -m "chore: add pyproject.toml for Python/uv environment"
```

---

### Task 3: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite CLAUDE.md to reflect the new structure**

```markdown
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
```

Wait — this needs to reflect the new structure. Update to:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open Source AI Market Map for Current AI — an interactive visualization of the open-source AI ecosystem across 7 stack layers, with gap analysis (red spots) and a crowdsourced roadmap. Built for Open Source Observer (OSO) under `oso-external/`.

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
- `docs/` — specs and methodology

### Design System

Palette uses CSS custom properties: `--paper` (warm off-white), `--ink` (deep brown-black), `--signal` (gap red), `--healthy` (teal), `--warm` (amber). Health thresholds: ≥70 = healthy, 45-69 = medium/fragile, <45 = gap.

### Data Sources

Notebooks query from multiple sources:
- `currentai.goodailist_repos.repos` — 14.7K AI repos (GoodAI List, OSO static model)
- `currentai.ossinsights_ai_collections.ossinsights_ai_collections` — 616 repos, 53 collections
- `data/*.csv` — OSAI gap map qualitative scores (41 subcategories × 10 dimensions)
- `oso.*` — public tables (projects, artifacts, developer metrics)

## Environment

- `OSO_API_KEY` loaded automatically via direnv (per-project `.envrc`)
- OSO MCP connects via SSE to localhost:8000 with Bearer token in `.mcp.json`
```

- [ ] **Step 2: Write the updated CLAUDE.md**

Replace the entire contents of `CLAUDE.md` with the second version above (the one with the new structure).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for restructured repo"
```

---

### Task 4: Build data inventory notebook — setup and source loading

**Files:**
- Create: `notebooks/data_inventory.py`

This task creates the notebook with header, setup, and all four data source load cells. Task 5 adds the analysis cells.

- [ ] **Step 1: Create `notebooks/data_inventory.py` with header and setup cells**

```python
import marimo

__generated_with = "unknown"
app = marimo.App()


@app.cell(hide_code=True)
def header(mo):
    mo.md(
        """
    # Data Inventory — Open Source AI Ecosystem

    Reconciling all data sources to understand coverage, overlap, and gaps
    across the open-source AI landscape.

    **Sources:** GoodAI List · OSS Insights · OSAI Gap Map · OSO Public Tables
    """
    )
    return


@app.cell(hide_code=True)
def setup_pyoso():
    import pyoso
    import marimo as mo
    pyoso_db_conn = pyoso.Client().dbapi_connection()
    return mo, pyoso_db_conn


@app.cell(hide_code=True)
def imports():
    import pandas as pd
    import plotly.graph_objects as go
    return go, pd


if __name__ == "__main__":
    app.run()
```

- [ ] **Step 2: Add the GoodAI List load cell**

Insert before the `if __name__` block:

```python
@app.cell(hide_code=True)
def load_goodailist(mo, pyoso_db_conn):
    df_goodailist = mo.sql(
        f"""
        WITH ranked AS (
          SELECT
            LOWER(repo) AS repo,
            LOWER(SPLIT_PART(repo, '/', 1)) AS owner,
            LOWER(SPLIT_PART(repo, '/', 2)) AS name,
            category,
            TRIM(SPLIT_PART(subcat, ',', 1)) AS primary_subcat,
            CAST(stars AS DOUBLE) AS stars,
            CAST(contributors AS DOUBLE) AS contributors,
            language,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(repo)
              ORDER BY updated_at DESC NULLS LAST
            ) AS _rn
          FROM currentai.goodailist_repos.repos
        )
        SELECT repo, owner, name, category, primary_subcat, stars, contributors, language
        FROM ranked
        WHERE _rn = 1
        """,
        output=False,
        engine=pyoso_db_conn
    )
    return (df_goodailist,)
```

- [ ] **Step 3: Add the OSS Insights load cell**

```python
@app.cell(hide_code=True)
def load_ossinsights(mo, pyoso_db_conn):
    df_ossinsights = mo.sql(
        f"""
        SELECT
          collection_id,
          collection_name,
          repo_id,
          LOWER(repo_name) AS repo,
          github_url
        FROM currentai.ossinsights_ai_collections.ossinsights_ai_collections
        """,
        output=False,
        engine=pyoso_db_conn
    )
    return (df_ossinsights,)
```

- [ ] **Step 4: Add the OSAI gap map CSV load cell**

```python
@app.cell(hide_code=True)
def load_osai_gap_map(pd):
    import pathlib
    _data_dir = pathlib.Path(__file__).parent.parent / "data"
    _csv_files = list(_data_dir.glob("*OSAI*gap*map*.csv")) + list(_data_dir.glob("*ch2a*scores*.csv"))
    if not _csv_files:
        df_osai_gap_map = pd.DataFrame()
    else:
        df_osai_gap_map = pd.read_csv(_csv_files[0], skiprows=1)
        df_osai_gap_map.columns = [
            'layer', 'subcategory', 'description', 'subcategory_id',
            'breadth', 'production_readiness', 'ease_of_adoption',
            'documentation', 'community_activity', 'performance_vs_closed',
            'enterprise_readiness', 'interoperability', 'sustainability',
            'standardization', 'criteria_avg', 'overall_score',
            'maturity', 'parity_verdict'
        ]
    return (df_osai_gap_map,)
```

- [ ] **Step 5: Add the OSO projects load cell**

```python
@app.cell(hide_code=True)
def load_oso_projects(mo, pyoso_db_conn):
    df_oso_projects = mo.sql(
        f"""
        SELECT
          p.project_id,
          p.project_name,
          p.display_name,
          a.artifact_namespace AS owner,
          a.artifact_name AS name,
          LOWER(a.artifact_namespace || '/' || a.artifact_name) AS repo
        FROM oso.projects_v1 p
        JOIN oso.artifacts_by_project_v1 a
          ON p.project_id = a.project_id
        WHERE a.artifact_source = 'GITHUB'
          AND a.artifact_type = 'REPOSITORY'
        """,
        output=False,
        engine=pyoso_db_conn
    )
    return (df_oso_projects,)
```

- [ ] **Step 6: Validate notebook structure**

```bash
uv run marimo check notebooks/data_inventory.py
```

Expected: passes with no errors.

- [ ] **Step 7: Commit**

```bash
git add notebooks/data_inventory.py
git commit -m "feat: add data inventory notebook with source loading cells"
```

---

### Task 5: Build data inventory notebook — analysis and coverage cells

**Files:**
- Modify: `notebooks/data_inventory.py`

- [ ] **Step 1: Add source summary stats cell**

Insert after the load cells, before `if __name__`:

```python
@app.cell(hide_code=True)
def source_summary(df_goodailist, df_ossinsights, df_osai_gap_map, df_oso_projects, mo):
    mo.hstack([
        mo.stat(
            label="GoodAI List",
            value=f"{len(df_goodailist):,}",
            bordered=True,
            caption=f"{df_goodailist['category'].nunique()} categories · {df_goodailist['primary_subcat'].nunique()} subcategories"
        ),
        mo.stat(
            label="OSS Insights",
            value=f"{df_ossinsights['repo'].nunique():,}",
            bordered=True,
            caption=f"{df_ossinsights['collection_name'].nunique()} collections"
        ),
        mo.stat(
            label="OSAI Gap Map",
            value=f"{len(df_osai_gap_map):,}",
            bordered=True,
            caption=f"{df_osai_gap_map['layer'].nunique()} layers · qualitative scores"
        ),
        mo.stat(
            label="OSO Projects",
            value=f"{df_oso_projects['repo'].nunique():,}",
            bordered=True,
            caption=f"{df_oso_projects['project_id'].nunique():,} projects"
        ),
    ], widths="equal", gap=1)
    return
```

- [ ] **Step 2: Add overlap analysis cell**

```python
@app.cell(hide_code=True)
def overlap_analysis(df_goodailist, df_ossinsights, df_oso_projects, mo, pd):
    _goodailist_repos = set(df_goodailist['repo'].dropna().unique())
    _ossinsights_repos = set(df_ossinsights['repo'].dropna().unique())
    _oso_repos = set(df_oso_projects['repo'].dropna().unique())

    _all_repos = _goodailist_repos | _ossinsights_repos | _oso_repos

    _overlap = pd.DataFrame({
        'repo': list(_all_repos)
    })
    _overlap['in_goodailist'] = _overlap['repo'].isin(_goodailist_repos)
    _overlap['in_ossinsights'] = _overlap['repo'].isin(_ossinsights_repos)
    _overlap['in_oso'] = _overlap['repo'].isin(_oso_repos)
    _overlap['source_count'] = (
        _overlap['in_goodailist'].astype(int)
        + _overlap['in_ossinsights'].astype(int)
        + _overlap['in_oso'].astype(int)
    )

    _summary = pd.DataFrame([
        {
            'Source Pair': 'GoodAI ∩ OSS Insights',
            'Overlap': len(_goodailist_repos & _ossinsights_repos),
            'Only Left': len(_goodailist_repos - _ossinsights_repos),
            'Only Right': len(_ossinsights_repos - _goodailist_repos),
        },
        {
            'Source Pair': 'GoodAI ∩ OSO',
            'Overlap': len(_goodailist_repos & _oso_repos),
            'Only Left': len(_goodailist_repos - _oso_repos),
            'Only Right': len(_oso_repos - _goodailist_repos),
        },
        {
            'Source Pair': 'OSS Insights ∩ OSO',
            'Overlap': len(_ossinsights_repos & _oso_repos),
            'Only Left': len(_ossinsights_repos - _oso_repos),
            'Only Right': len(_oso_repos - _ossinsights_repos),
        },
    ])

    mo.vstack([
        mo.md(f"""
        ## Source Overlap

        **{len(_all_repos):,}** unique repos across all sources.
        **{(_overlap['source_count'] >= 2).sum():,}** appear in 2+ sources.
        **{(_overlap['source_count'] == 3).sum():,}** appear in all three.
        """),
        mo.ui.table(_summary, show_column_summaries=False, show_data_types=False),
    ])
    return (_overlap,)
```

- [ ] **Step 3: Add coverage by GoodAI category cell**

```python
@app.cell(hide_code=True)
def coverage_by_category(df_goodailist, df_oso_projects, go, mo, pd):
    _goodailist_repos = set(df_goodailist['repo'].dropna().unique())
    _oso_repos = set(df_oso_projects['repo'].dropna().unique())

    _by_cat = df_goodailist.groupby('category').agg(
        total=('repo', 'nunique'),
    ).reset_index()
    _matched = df_goodailist[df_goodailist['repo'].isin(_oso_repos)].groupby('category').agg(
        in_oso=('repo', 'nunique'),
    ).reset_index()
    _by_cat = _by_cat.merge(_matched, on='category', how='left').fillna(0)
    _by_cat['in_oso'] = _by_cat['in_oso'].astype(int)
    _by_cat['pct_in_oso'] = (_by_cat['in_oso'] / _by_cat['total'] * 100).round(1)
    _by_cat = _by_cat.sort_values('total', ascending=True)

    _fig = go.Figure()
    _fig.add_trace(go.Bar(
        y=_by_cat['category'], x=_by_cat['total'], orientation='h',
        name='GoodAI List total', marker_color='#c9bfac',
    ))
    _fig.add_trace(go.Bar(
        y=_by_cat['category'], x=_by_cat['in_oso'], orientation='h',
        name='Also in OSO', marker_color='#1b6b5e',
    ))
    _fig.update_layout(
        barmode='overlay',
        template='plotly_white',
        height=360,
        margin=dict(t=10, l=0, r=30, b=40),
        legend=dict(orientation='h', yanchor='bottom', y=1.01, xanchor='left', x=0),
        xaxis=dict(title='Repos', showgrid=True, gridcolor='#E5E5E5'),
        yaxis=dict(title=''),
    )

    mo.vstack([
        mo.md("## Coverage by GoodAI Category"),
        mo.md("How many GoodAI List repos also exist as OSO projects?"),
        mo.ui.plotly(_fig),
    ])
    return
```

- [ ] **Step 4: Add OSAI gap map summary cell**

```python
@app.cell(hide_code=True)
def osai_gap_map_summary(df_osai_gap_map, go, mo):
    if df_osai_gap_map.empty:
        mo.md("_OSAI gap map CSV not found in `data/`._")
        return

    _df = df_osai_gap_map.copy()
    _df['overall_score'] = pd.to_numeric(_df['overall_score'], errors='coerce')
    _df = _df.dropna(subset=['overall_score'])
    _df = _df.sort_values('overall_score', ascending=True)

    _color_map = {1: '#c8341d', 2: '#d97c2a', 3: '#6b6253', 4: '#1b6b5e'}
    _colors = [_color_map.get(int(s), '#999') for s in _df['overall_score']]

    _fig = go.Figure(go.Bar(
        y=_df['layer'] + ' · ' + _df['subcategory'],
        x=_df['overall_score'],
        orientation='h',
        marker_color=_colors,
        customdata=list(zip(_df['maturity'], _df['parity_verdict'])),
        hovertemplate="<b>%{y}</b><br>Score: %{x}<br>Maturity: %{customdata[0]}<br>Parity: %{customdata[1]}<extra></extra>",
    ))
    _fig.update_layout(
        template='plotly_white',
        height=max(400, len(_df) * 22),
        margin=dict(t=10, l=0, r=30, b=40),
        xaxis=dict(title='Overall Score (1-4)', dtick=1, range=[0, 5]),
        yaxis=dict(title='', showgrid=False),
    )

    _score_dist = _df['overall_score'].value_counts().sort_index()
    mo.vstack([
        mo.md(f"""
        ## OSAI Gap Map · Qualitative Assessment

        {len(_df)} subcategories scored across {_df['layer'].nunique()} layers.
        Score distribution: {', '.join(f'**{int(k)}**: {v}' for k, v in _score_dist.items())}
        """),
        mo.ui.plotly(_fig),
    ])
    return
```

- [ ] **Step 5: Add the `pd` import fix**

The `osai_gap_map_summary` cell uses `pd` but gets it from the `imports` cell. Make sure the cell signature includes it:

```python
def osai_gap_map_summary(df_osai_gap_map, go, mo, pd):
```

(Already correct in the code above — just verify.)

- [ ] **Step 6: Validate notebook structure**

```bash
uv run marimo check notebooks/data_inventory.py
```

Expected: passes with no errors.

- [ ] **Step 7: Run the notebook interactively to verify**

```bash
uv run marimo edit notebooks/data_inventory.py
```

Expected: All cells execute. You see:
- Four stat boxes (GoodAI: ~14.7K, OSS Insights: ~616, OSAI Gap Map: 41, OSO Projects: many thousands)
- Overlap matrix table
- Coverage bar chart by category
- OSAI gap map horizontal bar chart

Stop the marimo server after verifying.

- [ ] **Step 8: Commit**

```bash
git add notebooks/data_inventory.py
git commit -m "feat: add analysis cells to data inventory notebook"
```

---

### Task 6: Update `.gitignore` and final cleanup

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ensure `.gitignore` covers both workspaces**

Verify `.gitignore` contains:

```
node_modules/
dist/
.env
.venv/
.env.local
*.log
.mcp.json
.DS_Store
__pycache__/
```

Add any missing entries.

- [ ] **Step 2: Remove stale root-level files if any remain**

Check that no orphaned `src/`, `index.html`, `package.json`, or `pnpm-lock.yaml` exist at the root (they should have been moved in Task 1 via `git mv`).

```bash
ls -la index.html src/ package.json pnpm-lock.yaml 2>&1
```

Expected: all "No such file or directory".

- [ ] **Step 3: Commit any cleanup**

```bash
git add .gitignore
git commit -m "chore: update gitignore for restructured repo"
```

---

### Task 7: Verify end-to-end

No files changed — this is a verification task.

- [ ] **Step 1: Verify website still works**

```bash
cd app && pnpm dev
```

Open `http://localhost:5173`. Verify Stack/Workflow/Matrix views, drawer, search, heatmap toggle. Stop the server.

- [ ] **Step 2: Verify notebooks pass structural checks**

```bash
uv run marimo check notebooks/data_inventory.py
uv run marimo check notebooks/oss_ai_trends.py
uv run marimo check notebooks/oss_ai_gaps.py
```

Expected: all three pass.

- [ ] **Step 3: Verify export script works**

```bash
uv run scripts/export_notebooks.py data_inventory.py
```

Expected: exports `data_inventory.html` to `app/public/notebooks/`. (May fail if marimo export needs a running pyoso connection — that's OK, just verify the script finds the notebook and attempts the export.)

- [ ] **Step 4: Verify final file structure matches spec**

```bash
find . -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.venv/*' -not -path '*/__pycache__/*' -type f | sort
```

Expected structure:

```
./CLAUDE.md
./app/index.html
./app/package.json
./app/pnpm-lock.yaml
./app/public/.gitkeep
./app/src/app.js
./app/src/data.js
./app/src/style.css
./data/2026.04.13 - OSAI gap map - ch2a_scores_spreadsheet.csv
./docs/plans/2026-04-27-restructure-and-data-inventory.md
./docs/specs/2026-04-27-ecosystem-mapping-design.md
./notebooks/data_inventory.py
./notebooks/oss_ai_gaps.py
./notebooks/oss_ai_trends.py
./pyproject.toml
./scripts/export_notebooks.py
./uv.lock
```
