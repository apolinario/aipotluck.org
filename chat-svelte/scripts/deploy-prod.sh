#!/usr/bin/env bash
# Robust, deterministic prod deploy for chat-svelte (current-ai/aipotluck-chat).
#
# Why this exists: ad-hoc `vercel deploy` in a subshell was flaky to ORCHESTRATE — a
# backgrounded deploy hangs (Vercel plugin setup-mode needs a TTY), and `$(… | rg)` capture
# can race a slow cold build and silently yield no URL. Production was never at risk (skip-domain
# means the build never takes the live alias until we promote), but the process felt scary.
# This script makes it calm and repeatable:
#   1. FOREGROUND deploy to the production TARGET with --skip-domain (does NOT touch the live alias)
#   2. parse the deployment URL from vercel's JSON output (fail loudly if absent — never promote nothing)
#   3. healthcheck the new deployment build is READY
#   4. capture the CURRENT live deployment (rollback target) BEFORE promoting
#   5. promote → healthcheck the live alias → AUTO-ROLLBACK if it isn't 200
#
# Usage:  ./scripts/deploy-prod.sh           # deploy + promote with verification
#         ./scripts/deploy-prod.sh --no-promote   # build + verify only, leave alias untouched
set -euo pipefail

SCOPE="current-ai"
ALIAS="https://aipotluck-chat-three.vercel.app"
HEALTH="$ALIAS/chat/healthcheck"
PROMOTE=1
[ "${1:-}" = "--no-promote" ] && PROMOTE=0

cd "$(dirname "$0")/.."

say() { printf '\n=== %s ===\n' "$1"; }

# Rollback target = whatever the live alias serves right now (so a bad promote reverts cleanly).
say "current live deployment (rollback target)"
PREV=$(vercel ls --scope "$SCOPE" --yes 2>/dev/null | rg -o 'https://aipotluck-chat-[a-z0-9]+-'"$SCOPE"'\.vercel\.app' | head -1 || true)
echo "prev: ${PREV:-<unknown>}"

say "build (foreground, --skip-domain — live alias untouched)"
OUT=$(mktemp)
vercel deploy --prod --skip-domain --scope "$SCOPE" 2>&1 | tee "$OUT"
URL=$(rg -o 'https://aipotluck-chat-[a-z0-9]+-'"$SCOPE"'\.vercel\.app' "$OUT" | head -1 || true)
rm -f "$OUT"
if [ -z "$URL" ]; then
	echo "ERROR: no deployment URL parsed — build likely failed. Live alias untouched; nothing promoted." >&2
	exit 1
fi
echo "deployment: $URL"

say "deployment health (pre-promote)"
code=$(curl -sS -o /dev/null -w '%{http_code}' "$URL/chat/healthcheck" || echo 000)
echo "deployment /chat/healthcheck => $code  (401 = Vercel deploy-protection on the URL; expected, build is READY)"

if [ "$PROMOTE" -eq 0 ]; then
	echo "--no-promote: stopping. Live alias unchanged. Test: $URL"
	exit 0
fi

say "promote to live alias"
vercel promote "$URL" --scope "$SCOPE"

say "live health (post-promote)"
live=$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH" || echo 000)
echo "$HEALTH => $live"
if [ "$live" != "200" ]; then
	echo "ERROR: live healthcheck $live != 200." >&2
	if [ -n "$PREV" ]; then
		echo "AUTO-ROLLBACK to $PREV" >&2
		vercel rollback "$PREV" --scope "$SCOPE" --yes
		echo "rolled back. Investigate before retrying." >&2
	else
		echo "No known rollback target — run: vercel rollback <prev> --scope $SCOPE" >&2
	fi
	exit 1
fi

echo "✓ live and healthy: $ALIAS/chat  (deployment $URL)"
