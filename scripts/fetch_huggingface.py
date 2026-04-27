"""Fetch top AI models and datasets from Hugging Face Hub."""

import csv
from pathlib import Path
from huggingface_hub import list_models, list_datasets

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

MODELS_CSV = DATA_DIR / "huggingface_models.csv"
DATASETS_CSV = DATA_DIR / "huggingface_datasets.csv"


def fetch_models(limit: int = 5000) -> list[dict]:
    """Fetch top models sorted by downloads."""
    print(f"Fetching top {limit} models by downloads...")
    rows = []
    for m in list_models(sort="downloads", limit=limit, full=True):
        rows.append({
            "model_id": m.id or "",
            "author": m.author or "",
            "downloads": m.downloads or 0,
            "likes": m.likes or 0,
            "pipeline_tag": m.pipeline_tag or "",
            "library_name": m.library_name or "",
            "created_at": str(m.created_at or ""),
            "last_modified": str(m.last_modified or ""),
            "tags": ",".join(m.tags) if m.tags else "",
        })
    print(f"  Fetched {len(rows)} models")
    return rows


def fetch_datasets(limit: int = 5000) -> list[dict]:
    """Fetch top datasets sorted by downloads."""
    print(f"Fetching top {limit} datasets by downloads...")
    rows = []
    for d in list_datasets(sort="downloads", limit=limit, full=True):
        rows.append({
            "dataset_id": d.id or "",
            "author": d.author or "",
            "downloads": d.downloads or 0,
            "likes": d.likes or 0,
            "created_at": str(d.created_at or ""),
            "last_modified": str(d.last_modified or ""),
            "tags": ",".join(d.tags) if d.tags else "",
        })
    print(f"  Fetched {len(rows)} datasets")
    return rows


def write_csv(path: Path, rows: list[dict]) -> None:
    """Write list of dicts to CSV."""
    if not rows:
        print(f"  No rows to write for {path.name}")
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Wrote {len(rows)} rows to {path.name}")


def preview(path: Path, n: int = 3) -> None:
    """Print first n rows of a CSV."""
    import pandas as pd
    df = pd.read_csv(path)
    print(f"\n--- {path.name}: {len(df)} rows, {len(df.columns)} columns ---")
    print(f"Columns: {list(df.columns)}")
    print(df.head(n).to_string(index=False))
    print()


def main():
    models = fetch_models()
    write_csv(MODELS_CSV, models)

    datasets = fetch_datasets()
    write_csv(DATASETS_CSV, datasets)

    # Verify
    preview(MODELS_CSV)
    preview(DATASETS_CSV)


if __name__ == "__main__":
    main()
