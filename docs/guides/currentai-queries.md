# CurrentAI Queries Guide

## Table naming

Use three-part names:
`currentai.<dataset>.<table>`

`oso.*` tables are public and can be queried with any valid key.

## SQL dialect (Trino)

- `CAST(x AS VARCHAR)` not `SAFE_CAST`
- `DATE_TRUNC('month', dt)` not `DATE_TRUNC(dt, MONTH)`
- `COALESCE` not `IFNULL`
- `CURRENT_DATE - INTERVAL '30' DAY` for date math
- `ARRAY_AGG` / `ARRAY_JOIN` not `STRING_AGG`

## Join and dedupe caveats

- Always `LOWER()` repo names when joining across sources.
- `currentai.goodailist_repos.repos` can contain duplicates; deduplicate by `LOWER(repo)` when needed.
- Bound exploratory queries with `LIMIT` and/or date windows.

## Gap semantics

- [`docs/catalog-gaps.md`](../catalog-gaps.md) = coverage/ingestion backlog (missing orgs/repos).
- `currentai.osai_gap_map` = maturity gap framework once data is present.

## Pointers

- Inventory + schedules: [`models/README.md`](../../models/README.md)
- Coverage backlog: [`docs/catalog-gaps.md`](../catalog-gaps.md)
- Compatibility router: [`docs/analysis-router.md`](../analysis-router.md)

