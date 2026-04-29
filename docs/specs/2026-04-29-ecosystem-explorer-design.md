# Ecosystem Explorer v1 — Design Spec

> Interactive data-driven explorer for the Current AI open-source AI ecosystem map.
> Lives alongside the existing landing page as a React Router route at `/explore`.

## Goals

1. Replace the hand-curated `data.js` with real warehouse data from the `currentai` org's 5 datasets
2. Provide a browsable, filterable, searchable interface to ~15K repos and ~14K projects
3. Surface OSAI layer taxonomy, gap analysis, geographic distribution, linked artifacts (packages, models), and activity trends
4. Match the landing page's dark starfield aesthetic — single cohesive site

## Non-Goals (v1)

- Workflow pipeline view (needs editorial curation of phase transitions)
- Matrix/dimension view (needs real per-dimension scores)
- Crowdsource/voting (needs backend persistence)
- User authentication or write operations
- Client-side API queries (all data is static at build time)

---

## Navigation & Routing

React Router with two routes sharing a layout shell:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `LandingPage` | Existing 5-section scroll page (unchanged) |
| `/explore` | `Explorer` | New data-driven explorer |

The existing `EcosystemSection.jsx` "Go to Ecosystem App" button (`href="#"`) becomes a `<Link to="/explore">`. The shared layout provides the palette toggle (dawn/dusk) and common fonts/grain.

## Design System

Inherits the landing page's existing tokens — no new design system:

- **Background**: `#020508` (near-black), `#050811` (section variant)
- **Fonts**: DM Sans (UI), DM Mono (data/labels), Cormorant Garamond (display headings)
- **Palette**: dawn/dusk from `app/src/data/palettes.js` — accent colors (`glowColor`, `accent`) adapt per mode
- **Cards**: glassmorphic — `background: rgba(255,255,255,0.03–0.07)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255,255,255,0.10–0.15)`, rounded corners
- **Health colors**: teal for healthy (>=70), amber for fragile (45-69), red-signal for gap (<45) — derived from palette accent range
- **Grain overlay**: existing `grain-noise.svg` via `::after` pseudo-element
- **Animations**: subtle hover lifts, fade-in on mount, sparkline draw

## Explorer Layout

The `/explore` page has three zones:

```
+--------------------------------------------------+
| Nav bar (shared)          [search] [dawn/dusk] [←]|
+--------------------------------------------------+
| Layer cards (horizontal scroll, 8 cards)          |
| [Infra] [Models:Code] [Models:Data] [Models:Wts] |
| [Product] [Docs] [Licensing] [Safeguards]         |
+--------------------------------------------------+
| Filters sidebar  |  Repo/project table            |
|  Layer (from     |  [name] [cat] [stars] [90d     |
|   cards above)   |   sparkline] [contributors]    |
|  Health bucket   |   [language] [country]          |
|  Country         |   [packages] [models]           |
|  Language        |                                 |
|  Activity level  |  ... 15K rows, virtualized ...  |
|                  |                                 |
+------------------+---------------------------------+
```

### Layer Summary Cards

- 8 cards in a horizontal row (flex-wrap on narrow screens)
- Each card shows: layer name, subcategory count, aggregate health (average gap_score across subcategories), top 3 project names by stars
- Clicking a card filters the table to repos in that layer
- Active card gets a highlighted border in the health color
- Data source: `taxonomy` + `investment_ranking` + `project_summary`

### Filter Sidebar

Persistent left sidebar (collapsible on mobile). Filter controls:

- **Layer**: populated from taxonomy (auto-set when clicking a layer card)
- **Subcategory**: populated dynamically based on selected layer
- **Health bucket**: healthy / fragile / gap checkboxes
- **Country**: searchable dropdown (values from `repos_summary.country`)
- **Language**: searchable dropdown (values from `repos_summary.language`)
- **Activity level**: slider or buckets (high/medium/low based on `commits_90d`)
- **Has packages**: toggle
- **Has models**: toggle

Filters compose with AND logic. Active filter count shown as badge. "Clear all" resets.

### Repo Table

The primary data surface. Sortable columns, virtualized for 15K rows.

| Column | Source | Notes |
|--------|--------|-------|
| Name | `repos_summary.repo` | Formatted as `org/repo`, links to GitHub |
| Category | `repos_summary.category` | GoodAI category |
| Subcategory | `repos_summary.subcategory` | GoodAI subcategory |
| Stars | `repos_summary.stars` | Formatted (e.g. "67k") |
| 90d Activity | `sparklines` | Mini sparkline (13 weekly data points) |
| Contributors | `repos_summary.total_contributors` | With FT/PT breakdown on hover |
| Language | `repos_summary.language` | Primary language |
| Country | `repos_summary.country` | Country of origin |
| Packages | joined from `packages` | Count badge, expandable |
| Models | joined from `models` | Count badge, expandable |
| Health | derived from taxonomy gap_score | Colored dot indicator |

Default sort: stars descending. Clicking a row opens the detail drawer.

Row virtualization required — rendering 15K DOM rows is not viable. Use a lightweight virtual scroll (e.g. `@tanstack/react-virtual` or a simple custom implementation with `position: absolute` and calculated offsets).

### Search

Global text search in the nav bar. Searches across repo name, description, category, subcategory, country, language, package names, model IDs. Client-side filtering over the static bundle — no debounced API calls needed, but debounce the filter application for smooth typing.

### Project Detail Drawer

Slide-out panel from the right (like the old app's drawer). Triggered by clicking a table row.

Sections:

1. **Header**: project display_name (or repo name if standalone), OSAI layer breadcrumb
2. **Health card**: gap_score ring, parity verdict label, investment priority badge
3. **Stats row**: total_stars, contributors_28d, full_time_28d, repo_count, package_count, model_count
4. **Activity chart**: 90-day sparkline expanded to a larger line chart with stars, forks, contributors overlaid
5. **Repos list**: all repos in the project with individual stars, language, 90d activity
6. **Packages**: list with source icon (NPM/PIP/Go/Rust/Maven/NuGet), name, link
7. **Models**: list with model_id, pipeline_tag, downloads, likes, benchmark_avg, model_family
8. **Dependency info**: direct_dependents, total_dependents, max_fragility_score (if nonzero)
9. **Taxonomy**: all OSAI layer/subcategory placements for this project
10. **Adjacent projects**: other top projects in the same subcategory (clickable, reopens drawer)

Drawer width: `min(600px, 92vw)`. Close on Escape, click-outside, or X button. Glassmorphic dark background with slightly elevated backdrop-filter.

---

## Data Pipeline

### Export Script Enhancement

Enhance `scripts/export_website_data.py` to produce a single JSON bundle at `app/src/data/explorer-data.json`:

```python
{
  "generated": "2026-04-29",
  "layers": [...],        # 8 OSAI layers with subcategories, gap scores, investment rankings
  "projects": [...],      # ~14K project summaries
  "repos": [...],         # ~15K repo snapshots
  "packages": [...],      # ~2.8K packages with source/URL
  "models": [...],        # ~6.4K models with downloads/benchmarks
  "sparklines": {...},    # repo -> weekly metric arrays (13 weeks)
  "taxonomy": [...]       # project -> layer/subcategory mappings
}
```

### Queries

Seven queries, run sequentially:

1. **layers**: `catalog.osai_gap_map` + `scores.investment_ranking` — 8 layers, ~42 subcategories
2. **projects**: `scores.project_summary` — ~14K rows, all columns
3. **repos**: `scores.repos_summary` — ~15K rows, all columns
4. **packages**: `entities.packages` — ~2.8K rows
5. **models**: `entities.models` — ~6.4K rows
6. **sparklines**: `metrics.daily` aggregated to weekly — ~15K repos × 13 weeks × 3 metrics (stars, contributors, forks)
7. **taxonomy**: `scores.taxonomy` — ~57K rows (projects appear in multiple subcategories)

### Sparkline Aggregation Query

```sql
SELECT
  repo,
  DATE_TRUNC('week', day) AS week,
  SUM(CASE WHEN metric = 'stars' THEN value ELSE 0 END) AS stars,
  SUM(CASE WHEN metric = 'forks' THEN value ELSE 0 END) AS forks,
  MAX_BY(CASE WHEN metric = 'contributors' THEN value ELSE 0 END, day) AS contributors
FROM currentai.metrics.daily
WHERE day >= CURRENT_DATE - INTERVAL '91' DAY
  AND metric IN ('stars', 'forks', 'contributors')
GROUP BY repo, DATE_TRUNC('week', day)
ORDER BY repo, week
```

Output format in JSON — keyed by repo, array of 13 weekly values:

```json
{
  "pytorch/pytorch": { "stars": [89,102,...], "forks": [34,28,...], "contributors": [45,48,...] },
  ...
}
```

### Bundle Size Budget

| Segment | Uncompressed | Gzipped |
|---------|-------------|---------|
| repos (15K × ~200B) | ~3.0 MB | ~400 KB |
| projects (14K × ~150B) | ~2.1 MB | ~280 KB |
| sparklines (15K × 13wk × 3m) | ~2.0 MB | ~300 KB |
| taxonomy (57K × ~80B) | ~4.6 MB | ~350 KB |
| models (6.4K × ~150B) | ~1.0 MB | ~130 KB |
| packages (2.8K × ~100B) | ~0.3 MB | ~40 KB |
| layers (42 subcats) | ~0.01 MB | ~1 KB |
| **Total** | **~13 MB** | **~1.5 MB** |

1.5 MB gzipped is acceptable for a data app. Can optimize later by lazy-loading sparklines or paginating taxonomy.

---

## Component Architecture

```
app/src/
├── main.jsx                    # BrowserRouter setup
├── App.jsx                     # Route definitions, shared layout
├── data/
│   ├── palettes.js             # (existing) dawn/dusk palette
│   ├── explorer-data.json      # (generated) static data bundle
│   └── ...existing data files
├── components/
│   ├── HomeHero.jsx            # (existing, untouched)
│   ├── EcosystemSection.jsx    # (existing, Link added)
│   ├── StorySection.jsx        # (existing, untouched)
│   ├── MissionSection.jsx      # (existing, untouched)
│   ├── RoadmapSection.jsx      # (existing, untouched)
│   ├── HeroScene.jsx           # (existing, untouched)
│   ├── Ship.jsx                # (existing, untouched)
│   ├── NavOverlay.jsx          # (existing, extended with router links)
│   ├── SectionDots.jsx         # (existing, untouched)
│   ├── Chevron.jsx             # (existing, untouched)
│   ├── GlassCard.jsx           # New shared glassmorphic card wrapper
│   └── explorer/
│       ├── Explorer.jsx        # Main explorer page layout
│       ├── LayerCards.jsx      # Horizontal layer summary row
│       ├── FilterSidebar.jsx   # Left filter panel
│       ├── RepoTable.jsx       # Virtualized sortable table
│       ├── RepoRow.jsx         # Single table row
│       ├── Sparkline.jsx       # Mini SVG sparkline component
│       ├── DetailDrawer.jsx    # Slide-out project/repo detail
│       ├── HealthBadge.jsx     # Colored dot + label
│       ├── SearchBar.jsx       # Global search input
│       └── ArtifactList.jsx    # Packages/models list for drawer
├── hooks/
│   ├── useExplorerData.js      # Loads and indexes the JSON bundle
│   └── useFilters.js           # Filter state management
├── utils/
│   ├── health.js               # Health bucket/color/label helpers
│   ├── format.js               # Number formatting (stars, etc.)
│   └── search.js               # Text search indexing
└── styles/
    └── global.css              # (existing, extended)
```

### Key Dependencies to Add

- `react-router-dom` — routing
- `@tanstack/react-virtual` — row virtualization (or custom impl if we want zero deps)

No other new dependencies. Sparklines are simple SVG paths. Charts in the drawer are also SVG.

---

## Interactions

### Table Sorting

Click column header to sort. Toggle asc/desc. Sort indicator arrow. Default: stars desc. Secondary sort by repo name for stability.

### Layer Card → Table Filter

Clicking a layer card sets the layer filter and scrolls the table area into view. Card gets highlighted border. Clicking again clears the filter.

### Search → Filter

Typing in search bar filters the table in real-time (debounced 150ms). Search matches against a pre-built index of repo names, descriptions, categories, countries. Highlight matching text in results.

### Table Row → Drawer

Click opens the drawer. If the repo belongs to a multi-repo project, the drawer shows the project-level view. If it's a standalone repo, the drawer shows repo-level detail.

### Drawer Navigation

"Adjacent projects" links in the drawer swap the drawer content without closing/reopening. Back button in drawer header returns to previous project if navigating between related projects.

### URL State

Filter state synced to URL query params: `?layer=infrastructure&country=US&q=pytorch`. Enables sharing filtered views via URL. Drawer state not in URL (ephemeral).

---

## Build Integration

### Vite Config Changes

- Add `@vitejs/plugin-react` (already present)
- JSON import works natively in Vite — `import data from './data/explorer-data.json'`
- No SSR or special build config needed

### Development Workflow

```bash
# Generate fresh data (requires OSO_API_KEY)
uv run scripts/export_website_data.py --output app/src/data/explorer-data.json

# Dev server with hot reload
cd app && pnpm dev

# Production build
cd app && pnpm build
```

The `explorer-data.json` is gitignored (generated artifact). CI/CD would run the export script before `pnpm build`. For local development without API access, a committed `explorer-data.sample.json` with ~100 repos provides a working subset.

---

## Validation & Sanity Checks

### Export Script Validation

The export script runs sanity checks after assembling the bundle and fails with a nonzero exit code if any check fails. This prevents deploying a broken data bundle.

**Structural checks:**

- Every OSAI layer (8 expected) has at least 1 subcategory
- Every subcategory has at least 2 projects with `total_stars > 100` (the "recognizable projects" threshold)
- Total repo count is within expected range (10K–20K)
- Total project count is within expected range (8K–18K)
- Sparklines object has entries for at least 50% of repos
- No layer has zero repos after taxonomy join

**Data quality checks:**

- No repo appears with negative stars or contributor counts
- Every repo has a non-empty `category` field
- Country field is present on at least 30% of repos (known coverage floor from GoodAI data)
- At least 1,000 repos have nonzero `commits_90d` (confirms events pipeline is flowing)
- Package and model counts are within expected ranges (packages: 1K–5K, models: 3K–10K)

**Known-good spot checks** — a hardcoded list of recognizable projects that must appear in specific layers:

```python
SPOT_CHECKS = {
    "Infrastructure": ["pytorch", "ray"],
    "Model Components: Code": ["transformers", "deepspeed"],
    "Model Components: Datasets": ["huggingface/datasets", "common-crawl"],
    "Model Components: Weights": ["llama", "mistral"],
    "Product/UX": ["langchain", "open-webui"],
    "Documentation": [],  # sparser, skip spot check
    "Licensing": [],       # sparser, skip spot check
    "Safeguards": ["guardrails"],
}
```

Each listed project must resolve to at least one repo in its layer via the taxonomy join. If a spot check fails, the script prints a warning with the missing project and layer — this catches taxonomy bridge gaps or upstream data issues.

### Runtime Checks (in-app)

The `useExplorerData` hook validates the loaded bundle on mount:

- If any layer has fewer than 2 projects, show a warning banner: "Some categories may have incomplete data"
- If the `generated` date is more than 7 days old, show a subtle staleness indicator in the nav
- If the bundle fails to parse or is missing expected top-level keys, show an error state instead of a broken UI

### Development Workflow

```bash
# Export with validation (default)
uv run scripts/export_website_data.py --output app/src/data/explorer-data.json

# Export skipping validation (for debugging partial data)
uv run scripts/export_website_data.py --output app/src/data/explorer-data.json --skip-validation

# Run validation only (no export)
uv run scripts/export_website_data.py --validate-only app/src/data/explorer-data.json
```

---

## Open Questions (to resolve during implementation)

1. **Taxonomy deduplication in table**: a project can appear in multiple subcategories (57K taxonomy rows for 14K projects). Table shows one row per repo — which subcategory to display? Answer: show primary (first by gap_score), expose full list in drawer.
2. **Sparkline absence**: not all 15K repos will have metrics data. Show empty/placeholder sparkline, or hide the column cell? Answer: show flat line at zero.
3. **Mobile table**: 15K-row virtualized table on mobile is awkward. Consider card layout below 768px breakpoint. Resolve during implementation.
