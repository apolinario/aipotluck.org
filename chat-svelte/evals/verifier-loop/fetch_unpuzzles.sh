#!/usr/bin/env bash
# Fetch the UNPUZZLES dataset (premise-altered classic riddles) into ./data/.
#
# Source: google-deepmind/unpuzzles_and_simple_reasoning
#   Paper:  Malek et al. 2025, "Frontier LLMs Still Struggle with Simple
#           Reasoning Tasks" (arXiv:2507.07313)
#   Data license: CC-BY 4.0 (attribution required — see ATTRIBUTION.md)
#
# The data is NOT vendored into our tree (gitignored); this script makes the
# eval reproducible without committing third-party CC-BY material upstream.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HERE/data"
mkdir -p "$DEST"

REPO="google-deepmind/unpuzzles_and_simple_reasoning"
FILE="datasets/unpuzzles.json"
OUT="$DEST/unpuzzles.json"

echo "Fetching $FILE from $REPO ..."
gh api "repos/$REPO/contents/$FILE" --jq '.content' | base64 -d > "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT") bytes, $(jq 'length' "$OUT") entries)"
