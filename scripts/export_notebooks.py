"""
Export notebooks to static HTML using `marimo export html`.

Auto-discovers *.py files under notebooks/, excluding __marimo__/ metadata.
Outputs to app/public/notebooks/ mirroring the source directory structure.

Usage:
  uv run scripts/export_notebooks.py                      # export everything
  uv run scripts/export_notebooks.py --category insights  # only notebooks/insights/
  uv run scripts/export_notebooks.py oss_ai_trends.py     # specific file(s)
"""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
NOTEBOOKS_DIR = REPO_ROOT / "notebooks"
OUTPUT_DIR = REPO_ROOT / "app" / "public" / "notebooks"

EXCLUDE_DIRS = {"__marimo__", "__pycache__"}


def find_notebooks(category: str | None = None) -> list[Path]:
    paths = []
    search_root = NOTEBOOKS_DIR / category if category else NOTEBOOKS_DIR
    if not search_root.exists():
        print(f"Category not found: {search_root}", file=sys.stderr)
        sys.exit(1)
    for root, dirs, files in os.walk(search_root, followlinks=True):
        root_path = Path(root)
        rel_root = root_path.relative_to(NOTEBOOKS_DIR)
        dirs[:] = [d for d in sorted(dirs) if d not in EXCLUDE_DIRS]
        for fname in sorted(files):
            if not fname.endswith(".py"):
                continue
            rel = rel_root / fname
            if any(part in EXCLUDE_DIRS for part in rel.parts):
                continue
            paths.append(root_path / fname)
    return paths


def export_notebook(src: Path) -> bool:
    rel = src.relative_to(NOTEBOOKS_DIR)
    out = OUTPUT_DIR / rel.with_suffix(".html")
    out.parent.mkdir(parents=True, exist_ok=True)

    print(f"  Exporting {rel} → {out.relative_to(REPO_ROOT)}")
    result = subprocess.run(
        [sys.executable, "-m", "marimo", "export", "html", "--no-include-code", str(src), "-o", str(out), "-f"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  ERROR exporting {rel}:", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        return False
    return True


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Export marimo notebooks to HTML.")
    parser.add_argument(
        "notebooks",
        nargs="*",
        metavar="NOTEBOOK",
        help="Specific notebook path(s) relative to notebooks/ (e.g. oss_ai_trends.py). "
             "If omitted, uses --category or exports all.",
    )
    parser.add_argument(
        "--category", "-c",
        metavar="CATEGORY",
        help="Top-level notebook directory to export (e.g. insights, data). "
             "Ignored when specific notebook paths are given.",
    )
    args = parser.parse_args()

    if args.notebooks:
        notebooks = []
        for n in args.notebooks:
            path = NOTEBOOKS_DIR / n
            if not path.exists():
                print(f"Not found: {path}", file=sys.stderr)
                sys.exit(1)
            notebooks.append(path)
    else:
        notebooks = find_notebooks(args.category)

    if not notebooks:
        print("No notebooks found.")
        return

    print(f"Found {len(notebooks)} notebook(s) to export.\n")
    failures = []
    for nb in notebooks:
        ok = export_notebook(nb)
        if not ok:
            failures.append(nb)

    print(f"\nDone. {len(notebooks) - len(failures)}/{len(notebooks)} succeeded.")
    if failures:
        print("Failed:")
        for f in failures:
            print(f"  {f.relative_to(NOTEBOOKS_DIR)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
