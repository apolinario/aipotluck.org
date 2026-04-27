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

Requires an [OSO API key](https://docs.oso.xyz) with access to the `currentai` org.

### Query CLI

```bash
uv run scripts/query.py "top repos by stars"
uv run scripts/query.py "trending"
uv run scripts/query.py "categories"
uv run scripts/query.py "gaps"
uv run scripts/query.py "search vllm"
uv run scripts/query.py "SELECT repo, stars FROM currentai.goodailist_repos.repos LIMIT 5"
```

Run `uv run scripts/query.py` with no arguments to see all available templates.

## Structure

```
app/          Website (Vite + vanilla JS)
notebooks/    Marimo notebooks for data analysis
scripts/      CLI tools (notebook export, data publishing)
data/         Raw external CSVs
docs/         Specs and methodology
```

## Data Sources

| Source | Description |
|--------|-------------|
| [GoodAI List](https://goodailist.com/) | 14.7K curated AI repos with categories and activity metrics |
| OSS Insights AI | 616 repos across 53 AI collections |
| OSAI Gap Map | Qualitative maturity scores across 41 subcategories |
| OSO Public Tables | Projects, artifacts, and developer metrics from the OSO warehouse |

## License

CC-BY-4.0
