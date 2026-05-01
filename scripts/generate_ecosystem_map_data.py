#!/usr/bin/env python3
"""Build app/src/data/ecosystemTopReposByCategory.json from explorer public data.

For each stack category, take up to 20 repos with the highest stars (repos_attrs).
Writes map-ready clusters with hub positions and per-repo ring offsets.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "app" / "public" / "data"
OUT = ROOT / "app" / "src" / "data" / "ecosystemTopReposByCategory.json"

# Distinct hues per layer (matches explorer stack layers)
LAYER_COLORS = {
    "infrastructure": "#7AB8A4",
    "model_code": "#9DCFCA",
    "model_datasets": "#3DAAB8",
    "model_weights": "#E8796A",
    "product_ux": "#D4A255",
    "documentation": "#A89CC8",
    "licensing": "#E8B86D",
    "safeguards": "#B8A08C",
    "governance": "#C9A86C",
    "research": "#8B9DC9",
}


def hub_positions(n: int) -> list[tuple[float, float]]:
    """Golden-angle spiral hubs, clamped to map-safe % coordinates."""
    positions = []
    for i in range(n):
        g = i * 2.39996322972865332
        r = 7.0 + math.sqrt(i + 1) * 3.15
        lx = 50.0 + r * math.cos(g) * 0.95
        ly = 48.0 + r * math.sin(g) * 0.88
        lx = max(22.0, min(78.0, lx))
        ly = max(24.0, min(72.0, ly))
        positions.append((round(lx, 2), round(ly, 2)))
    return positions


def repo_ring_offsets(count: int, seed: int) -> list[tuple[float, float]]:
    """Even ring + slight jitter so dots don't stack."""
    if count <= 0:
        return []
    rng = seed * 1103515245 + 12345
    out = []
    for j in range(count):
        angle = 2 * math.pi * j / max(count, 1) + (seed % 17) * 0.07
        rad = 2.15 + (j % 5) * 0.38 + (j % 3) * 0.12
        rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
        jitter = (rng / 0x7FFFFFFF - 0.5) * 0.35
        dx = round((rad + jitter) * math.cos(angle), 2)
        dy = round((rad + jitter * 0.9) * math.sin(angle), 2)
        out.append((dx, dy))
    return out


def main() -> None:
    categories = json.loads((PUBLIC / "categories.json").read_text())
    layers = json.loads((PUBLIC / "layers.json").read_text())
    products = json.loads((PUBLIC / "products.json").read_text())
    repos_attrs = json.loads((PUBLIC / "repos_attrs.json").read_text())

    layer_name = {l["id"]: l["display_name"] for l in layers}
    layer_sort_order = {l["id"]: int(l["sort_order"]) for l in layers}
    stars_by_pid = {r["product_id"]: int(r.get("stars") or 0) for r in repos_attrs}

    by_cat: dict[str, list[dict]] = defaultdict(list)
    for p in products:
        if p.get("product_type") != "repo":
            continue
        cid = p.get("category_id")
        if not cid:
            continue
        pid = p["product_id"]
        stars = stars_by_pid.get(pid, 0)
        slug = (pid or "").replace("repo:", "", 1)
        name = p.get("display_name") or slug.split("/")[-1] or slug
        by_cat[cid].append(
            {
                "product_id": pid,
                "display_name": name,
                "stars": stars,
            }
        )

    hubs = hub_positions(len(categories))
    clusters_out = []

    for idx, cat in enumerate(categories):
        cid = cat["id"]
        layer_id = cat.get("layer_id") or ""
        top = sorted(by_cat.get(cid, []), key=lambda x: (-x["stars"], x["display_name"].lower()))[:20]
        lx, ly = hubs[idx]
        color = LAYER_COLORS.get(layer_id, "#6B8E9E")
        offsets = repo_ring_offsets(len(top), hash(cid) % 10_000)

        repos_json = []
        for (repo, (dx, dy)) in zip(top, offsets):
            repos_json.append(
                {
                    "name": repo["display_name"],
                    "productId": repo["product_id"],
                    "stars": repo["stars"],
                    "dx": dx,
                    "dy": dy,
                }
            )

        clusters_out.append(
            {
                "id": cid,
                "color": color,
                "label": cat.get("display_name") or cid,
                "layerId": layer_id,
                "layerName": layer_name.get(layer_id, layer_id),
                "layerSortOrder": layer_sort_order.get(layer_id, 999),
                "gapScore": cat.get("gap_score"),
                "criteriaAvg": cat.get("criteria_avg"),
                "lx": lx,
                "ly": ly,
                "repos": repos_json,
            }
        )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "app/public/data/products.json + repos_attrs.json + categories.json",
        "top_n_per_category": 20,
        "clusters": clusters_out,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    total_repos = sum(len(c["repos"]) for c in clusters_out)
    print(f"Wrote {OUT} — {len(clusters_out)} categories, {total_repos} repo dots")


if __name__ == "__main__":
    main()
