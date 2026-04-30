# Explorer App — Design Spec

**Date**: 2026-04-30
**Source**: Claude Design handoff — Open Source AI Market Map v7

## Overview

Port the v7 HTML/CSS/JS prototype into a React app integrated with the existing Vite landing page. The explorer provides three views (Stacks, Repos, Teams) of the open-source AI ecosystem, with slide-out drawers for detail, filters, search, and pagination. All data is loaded from static JSON files at runtime.

## Routing

Add `react-router-dom` with two routes:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `App` (existing) | Landing page with all current sections |
| `/app` | `ExplorerApp` | Explorer app, full viewport |

- The NavOverlay "Explore App →" link becomes `<Link to="/app">`
- The explorer's topbar brand mark links back to `/` via `<Link to="/">`
- No shared nav between landing page and explorer — each has its own topbar

## Design System (v7 — Tinted Paper)

The explorer uses a light "tinted paper" theme, distinct from the landing page's dark theme.

### CSS Custom Properties

```css
:root {
  --paper: #E8E4DE;
  --paper-2: #DDD8D0;
  --paper-3: #D0C9BF;
  --ink: #0B1E2D;
  --ink-2: #3a4f5e;
  --ink-3: #687A84;
  --rule: #0B1E2D;
  --rule-soft: rgba(0,0,0,.16);
  --signal: #C85566;
  --healthy: #5B9E8A;
  --warm: #D4A255;
  --accent: #3DAAB8;
  --coral: #E8796A;
  --shadow-1: 0 2px 12px rgba(0,0,0,.04);
  --radius: 6px;
  --radius-2: 10px;
}
```

### Fonts

Same families as landing page (already loaded via Google Fonts):
- **Cormorant Garamond** 300/400/500 — headings, layer labels, drawer titles
- **DM Sans** 400/500/600 — body, nav, buttons, filters
- **DM Mono** 400/500 — data labels, stats, badges, repo names

### Health/Verdict System

Three buckets mapped from `parity_verdict`:
- `competitive` → **healthy** (sage `#5B9E8A`, left border + tinted bg)
- `unique_to_oss` → **unique** (teal `#3DAAB8`, left border + tinted bg)
- `closed_leads` / `no_oss_exists` → **gap** (rose `#C85566`, left border + pulsing red dot)

## Data Loading

### Files

Copy from design bundle `project/uploads/` to `app/public/data/explorer/`:

| File | Size | Phase |
|------|------|-------|
| `layers.json` | 15KB | 1 |
| `categories.json` | 58KB | 2 |
| `entities.json` | 2.9MB | 2 |
| `products.json` | 6.1MB | 2 |
| `repos_attrs.json` | 5.4MB | 2 |
| `models_attrs.json` | 1.4MB | 2 |
| `packages_attrs.json` | 462KB | 2 |
| `contributions_attrs.json` | 80KB | 3 (lazy) |

### Loading Strategy

Three-phase runtime fetch:

1. **Phase 1** — `layers.json` alone. Renders the Stacks view skeleton immediately.
2. **Phase 2** — Everything else in parallel (`categories`, `entities`, `products`, `repos_attrs`, `models_attrs`, `packages_attrs`). Fills in category chips, entity names, stats. Enables Teams view.
3. **Phase 3** — `contributions_attrs.json`, loaded on-demand when user navigates to Repos tab.

Show "Loading…" placeholders (Cormorant Garamond 300, centered, `--ink-3`) until each phase resolves.

## Component Structure

All new files under `app/src/components/explorer/`:

```
ExplorerApp.jsx          — route root, data loading orchestrator, state container
Topbar.jsx               — sticky topbar: brand link, view tabs, mobile select, stats, search, contribute button
StacksView.jsx           — layer rows → category cells grid
ReposView.jsx            — filter bar + sortable paginated table
TeamsView.jsx            — filter bar + entity card grid
Drawer.jsx               — generic slide-out shell (scrim + panel + close button)
CategoryDrawerContent.jsx — category detail body
RepoDrawerContent.jsx    — repo detail body
EntityDrawerContent.jsx  — entity detail body
FilterBar.jsx            — shared filter bar layout
PresetButtons.jsx        — country preset pill group (All, US, China, EU, etc.)
ProductRow.jsx           — reusable product list item
```

Plus one CSS file: `app/src/styles/explorer.css`

### Styles Approach

All v7 CSS goes into `explorer.css`, scoped under a `.explorer` wrapper class on `ExplorerApp`'s root div. This prevents any bleed into the landing page's dark-theme styles. CSS custom properties are defined within `.explorer { }`.

## Views

### Stacks View (default)

- Grid of layer rows. Each row: left label column (190px) + right 4-column grid of category cells
- Layer label shows: sort order badge (colored by layer), display name (Cormorant Garamond 22px), description, open/closed counts
- Category cells show: name, verdict badge (colored pill), OSS count + maturity, entity chips (top 3 open + 1 closed, "+N more")
- Cells have colored left border by health bucket, hover lifts with shadow
- Gap cells have a static red dot (top-right) that pulses on hover
- Search filters categories by name
- Clicking a cell opens the Category Drawer

### Repos View

- **Filter bar**: Layer dropdown, Language dropdown, License dropdown, Country dropdown, separator, country preset pills (All, US, China, EU, Excl. US+CN, Rest of world)
- **Header**: "N repos · sorted by [sort label]"
- **Table**: 8-column grid (Maintained by, Repository, Category, Stars, +7d, Commits/90d, Language, License)
  - Sortable columns: Maintained by, Repository, Stars, +7d, Commits/90d
  - Sort indicators: chevron up/down SVGs
  - Hover row highlights with teal tint
- **Pagination**: bottom bar with "Showing X–Y of N", page size selector (25/50/100), prev/next buttons
- Country dropdown and preset pills are mutually exclusive (selecting one clears the other)
- Search filters by repo name, description, or entity name
- Clicking a row opens the Repo Drawer

### Teams View

- **Filter bar**: Type dropdown (Individual/Organization), Products dropdown (Has Repos, Has Models, etc.), Country dropdown, separator, country preset pills, team count
- **Grid**: `auto-fill, minmax(240px, 1fr)` of entity cards
- Entity cards show: name, type badge (teal for org, sage for individual), country, layer chips (max 3 + overflow), compact stats (top 4 product types with counts)
- Search filters by display name, entity ID, or aliases
- Clicking a card opens the Entity Drawer

## Drawers

All drawers share the same shell: fixed scrim (`rgba(26,24,20,.38)` + `blur(2px)`), right-side panel (max 640px, 94vw), slide-in animation (cubic-bezier `.2,.8,.2,1`), close via X button / scrim click / Escape key.

### Category Drawer

- **Header**: crumb ("Layer · Category"), title
- **Stat strip**: verdict badge, gap score (/5), OSS count, closed count
- **Analysis card**: parity rationale with colored left border matching verdict
- **Type tabs**: product type pills (Repos, Models, Packages, etc.) with counts — clicking switches the product list below
- **Product list**: `ProductRow` components, initially 20 items with "Show all N →" load-more button
- **Maturity dimensions**: horizontal bar chart (dimension label, bar, value /5)

### Repo Drawer

- **Header**: crumb ("Repository"), title in DM Mono (the prototype uses JetBrains Mono here but we normalize to DM Mono per design system)
- **Stat strip**: stars, +7d, commits/90d, language, license
- **Description box**: repo description in tinted card
- **Stack context**: breadcrumb (Layer › Category), verdict badge, parity rationale
- **Maintained by**: clickable entity card with type badge, name, country, contribution count, GitHub/website links
- **More from org**: up to 4 related products from same entity
- **Footer actions**: "View on GitHub" (coral pill), "View [entity] →", "View [category] →"
- Clicking the entity card opens the Entity Drawer (replaces content)

### Entity Drawer

- **Header**: crumb ("Type · Teams"), title
- **Summary box**: auto-generated text ("X is a/an [type] based in [country]. They have N open source and M closed source contributions across K layers.")
- **Meta row**: country flag, GitHub link pill, website link pill, contribution count
- **Layer chips**: colored pills for each spanned layer
- **Type tabs**: product type pills with counts (same as category drawer)
- **Product list**: sorted by stars/downloads, max 40 items

## Shared Components

### ProductRow

Renders a single product in a list. Product names use `DM Mono` (the prototype has inline `JetBrains Mono` references — normalize these). Two modes:
- **With type badge** (default): shows badge pill (e.g. "Repo", "Model"), name (monospace link), metrics, description, secondary info
- **Without type badge** (`noTypeBadge`): simpler layout for within-type-tab contexts

Props control: `showDesc`, `showTeam`, `showCategory`, `noEntity`, `noTypeBadge`

### PresetButtons

Row of country-filter pills. Manages active state. Selecting a preset clears the country dropdown; selecting a country clears the preset.

### FilterBar

Horizontal flex layout with control groups (label + select), separators, and preset buttons.

## Constants & Helpers

Port from `app-v4.js`:
- `FLAGS` — country → emoji flag map
- `LAYER_COLORS` — layer ID → oklch color string
- `TYPE_LABELS` / `TYPE_LABEL_S` — product type → plural/singular display names
- `TYPE_ORDER` — canonical tab ordering for drawers
- `OPEN_TYPES` — set of product types considered "open"
- `MATURITY_LABELS` — dimension key → human label
- `EU` — set of EU country names (for preset filtering)
- `matchesPreset()` — country preset logic
- `fmt()` / `fmtN()` — number formatting (1.2M, 3k, 1,234)
- `entityName()` — display name normalization
- `bucketFromVerdict()` / `verdictShort()` / `verdictLong()` — verdict system

## State Management

All state lives in `ExplorerApp` via React hooks. No external state library.

Key state:
- `view` — active view tab (`stacks` | `repos` | `teams`)
- `loaded` — loading phase flags (`{ phase1, phase2, repos }`)
- `layers`, `catMap`, `entityMap`, `products`, etc. — parsed data
- `stackSearch` — stacks view search query
- `reposSort` — `{ col, dir }` for table sorting
- `reposFilter` — `{ layer, country, lang, license }`
- `reposCountryPreset` — active preset name
- `reposFiltered`, `reposPage`, `reposPageSize` — filtered/paginated repo list
- `teamsFilter` — `{ type, country, productType }`
- `teamsCountryPreset` — active preset name
- `drawer` — `{ open, type, id }` for controlling the drawer

Derived data (entity summaries, cat-entity maps, type counts) computed via `useMemo`.

## Responsive Behavior

Matching the prototype's breakpoints:

- **≤1100px**: category grid → 2 columns, layer label → 155px, table hides License column
- **≤740px**: layer rows stack vertically, nav tabs → mobile select dropdown, topbar search expands full-width, table further simplifies

## Deployment

Cloudflare Pages. Vite build output (`app/dist/`) served as static files. Add `_redirects` or Cloudflare routing config for SPA fallback (all routes → `index.html`).

## Out of Scope

- "Contribute →" button functionality (kept as placeholder)
- Authentication or user accounts
- Server-side rendering
- Real-time data updates
- The old `data.js` curated dataset (replaced by the JSON files from the data pipeline)
