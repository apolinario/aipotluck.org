# Models

SQL source for User Defined Models (UDMs) deployed to the `currentai` org on the OSO data warehouse.

Each `.sql` file corresponds to a deployed data model. The file is the source of truth for the query — edits here should be synced to OSO via `createDataModelRevision`.

## Deployed Models

| Model | Table | Schedule | Description |
|-------|-------|----------|-------------|
| [ai_repo_packages](ai_repo_packages.sql) | `currentai.ai_repo_packages.ai_repo_packages` | Weekly | Links AI repos to published packages (NPM, PIP, Go, Maven, NuGet, Rust) |

## Querying

```sql
SELECT * FROM currentai.ai_repo_packages.ai_repo_packages LIMIT 10
```

Or via the CLI:

```bash
uv run scripts/query.py "SELECT package_source, COUNT(DISTINCT repo) AS repos, COUNT(DISTINCT package_name) AS packages FROM currentai.ai_repo_packages.ai_repo_packages GROUP BY package_source ORDER BY packages DESC"
```
