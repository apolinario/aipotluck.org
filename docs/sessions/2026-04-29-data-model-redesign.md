# Session Log — 2026-04-29

## Data Model Redesign

Replaced the ad-hoc 14-dataset layout with a proper 5-dataset semantic data model deployed in the `currentai` org on OSO.

### What we built

**5 datasets, 13 tables:**

| Dataset | Tables | Key metrics |
|---------|--------|-------------|
| `catalog` (static) | goodailist_repos, model_benchmarks, model_repos, foundation_model_repos, osai_gap_map, osai_subcategory_mapping, taxonomy_crosswalk | 7 CSV reference tables |
| `entities` (UDM) | repos, projects, packages, models | 15K repos, 14K projects, 2.8K packages, 6.4K models |
| `events` (UDM) | github_events | 24M events, 12-month window |
| `metrics` (UDM) | daily | 5.1M rows, 8 metric types (normalized long format) |
| `scores` (UDM) | taxonomy, dependency_graph, fragility, investment_ranking, project_summary, repos_summary, ossd_coverage | 7 interpretive/summary tables |

**Design decisions:**
- Entity grain: OSO project (9.3% match rate) with standalone repo fallback
- `project_slug` as human-readable key throughout
- `entities.repos` is the foundation table — everything chains off it
- `events.github_events` pre-filters GitHub Archive to our 15K repos (name-based join — ID-based exceeded Trino's 15GB memory limit)
- `metrics.daily` normalized long format (repo × day × metric → value)
- `scores.repos_summary` pre-computes per-repo snapshot for fast notebook queries (successor to old `ai_repo_activity`)
- `entities.packages` uses `oso.package_owners_v0` (not `artifacts_by_project_v1` which was too slow)
- Projects table is slim (no categories/languages — derive via joins)
- Taxonomy in `scores` (interpretive layer, not entities)

**Also completed:**
- All 7 notebooks updated to new table names and tested
- Verification script (`scripts/verify_migration.py`) with 26 automated checks
- Website export script (`scripts/export_website_data.py`) — queries mart tables → JS
- OSSD YAML generator (`scripts/generate_ossd_yaml.py`) — coverage gaps → YAML for oss-directory PRs
- Docs rewritten (models/README.md, CLAUDE.md, query guide)
- 13 old datasets deleted from OSO
- Spec and implementation plan archived with deviations

### What's next

1. **Ecosystem explorer app** — standalone React page at `/explore` sharing the landing page's design system (DM Sans/Mono, dawn/dusk palette, dark starfield). Data-driven from our mart tables. The landing page's "Go to Ecosystem App" button links here.

2. **oss-directory push** — ~672 orgs with 3+ repos. Use `scripts/generate_ossd_yaml.py --min-repos 3`. Improves project match rate from 9.3% to ~30%+.

3. **Dependency graph OOM** — `scores.dependency_graph` occasionally exceeds Trino's 15GB limit on rebuild. Existing data is intact. Needs query optimization (possibly pre-filter `int_code_dependencies` or split the depth-2 expansion).

4. **Website data integration** — the app was rewritten to React (by colleague). Old `data.js` with `MARKET_MAP_DATA` is gone. New app uses hand-curated data files (`stackData.js`, `ecoClusters.js`). The `export_website_data.py` script needs updating to match the new schema, or (better) the ecosystem app consumes our mart tables directly.

### Key references

- Spec: `docs/specs/2026-04-29-data-model-design.md`
- Implementation plan: `docs/plans/2026-04-29-data-model-implementation.md`
- Model inventory: `models/README.md`
- Query guide: `docs/guides/currentai-queries.md`
- PR: https://github.com/opensource-observer/ecosystem-mapping/pull/1
