# Open Source AI Market Map

An interactive visualization of the open-source AI ecosystem — mapping 7 stack layers from silicon to chat, colored by where the open ecosystem is healthy, fragile, or missing entirely.

## Quick Start

### Website

```bash
cd app
pnpm install
pnpm dev
```

Open http://localhost:5173 to see the interactive map.

### Notebooks

```bash
cp .env.example .env    # add your OSO API key
uv sync
uv run marimo edit notebooks/data_inventory.py
```

Requires an [OSO API key](https://www.oso.xyz) with access to the `currentai` org.

### Query CLI

```bash
uv run scripts/query.py "top repos by stars"
uv run scripts/query.py "gaps"
uv run scripts/query.py "SELECT repo, stars FROM currentai.goodailist_repos.repos LIMIT 5"
```

Run `uv run scripts/query.py` with no arguments to see all available templates.

## Analyst Modes

This repo provides one local analyst persona:

- **`pyoso-analyst`**: use [`pyoso-analyst`](./.claude/skills/pyoso-analyst/SKILL.md) when you have an API key and must keep operations read-only via `pyoso`.

Guides:
- Querying + transforms: [`docs/guides/currentai-queries.md`](docs/guides/currentai-queries.md)
- Notebooks + marimo style: [`docs/guides/currentai-notebooks.md`](docs/guides/currentai-notebooks.md)

## Structure

```
app/          Website (Vite + vanilla JS)
notebooks/    Marimo notebooks for data analysis
scripts/      CLI tools (notebook export, data publishing)
data/         Raw CSVs
models/       SQL models deployed to the OSO data warehouse
docs/         Specs, methodology, session logs (`specs/`, `plans/`, `sessions/`)
```

## Primary Data Sources

| Source | Description |
|--------|-------------|
| [Good AI List](https://goodailist.com/) | Curated AI repos with categories and activity metrics |
| [OSS Insights](https://ossinsight.io/collections) | Additional repos across AI-tagged collections |
| [OSO Public Tables](https://www.oso.xyz) | Projects, artifacts, and developer metrics from the OSO data lake |
| [Hugging Face](https://huggingface.co/) | Model and dataset catalogs |
| [AI Incident Database](https://incidentdatabase.ai/) | Safety/safeguards incidents |
| OSAI Gap Map | Qualitative maturity scores across 41 subcategories |

## Documentation

- Repo/assistant ops (Claude Code guidance, commands, env/MCP): [`CLAUDE.md`](CLAUDE.md)
- Warehouse querying conventions (Trino SQL, joins, naming/dedupe caveats): [`docs/guides/currentai-queries.md`](docs/guides/currentai-queries.md)
- Notebook authoring conventions (marimo workflow + style): [`docs/guides/currentai-notebooks.md`](docs/guides/currentai-notebooks.md)
- Model inventory + refresh flows (UDMs, static/bridge models): [`models/README.md`](models/README.md)
- Catalog coverage backlog (missing orgs/repos to add): [`docs/catalog-gaps.md`](docs/catalog-gaps.md)
