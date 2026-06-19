// Keep the chat's answer-grounding catalog in lockstep with the site's.
//
// `src/lib/server/textGeneration/data/categories.json` is a byte-identical copy
// of the site's canonical `app/public/data/categories.json` (the 8-category gap-map
// framework grounding.ts reads to make the model SELECT real tools, not confabulate
// them). The chat app deploys from its own dir, so it CANNOT import the sibling at
// build time — it must vendor a committed copy. That copy can silently drift when the
// gap-map data is re-audited on the site side (the data carries `last_audited`).
//
// This script is the single deterministic sync point:
//   node scripts/sync-categories.mjs          # copy canonical -> chat copy (the fix)
//   node scripts/sync-categories.mjs --check   # assert in sync, exit 1 on drift (CI)
//
// The vitest guard (categories-sync.spec.ts) runs the same check inside `pnpm test`,
// so a drifted copy turns the suite red and the fix is one command (npm run
// sync:categories). If the canonical
// file isn't present (a standalone chat-svelte checkout, outside the monorepo) this
// is a no-op success — there's nothing to sync against.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const CANONICAL = resolve(here, "../../app/public/data/categories.json");
const CHAT_COPY = resolve(here, "../src/lib/server/textGeneration/data/categories.json");

const check = process.argv.includes("--check");

if (!existsSync(CANONICAL)) {
	console.log(
		`sync-categories: canonical site copy not found (${CANONICAL}) — standalone checkout, nothing to sync.`
	);
	process.exit(0);
}

const canonical = readFileSync(CANONICAL);
const current = existsSync(CHAT_COPY) ? readFileSync(CHAT_COPY) : null;
const inSync = current !== null && canonical.equals(current);

if (inSync) {
	console.log("sync-categories: chat copy is in sync with the site canonical. ✓");
	process.exit(0);
}

if (check) {
	console.error(
		"sync-categories: DRIFT — chat categories.json differs from the site canonical.\n" +
			"  canonical: app/public/data/categories.json\n" +
			"  chat copy: chat-svelte/src/lib/server/textGeneration/data/categories.json\n" +
			"  fix: run `npm run sync:categories` and commit the result."
	);
	process.exit(1);
}

writeFileSync(CHAT_COPY, canonical);
console.log("sync-categories: chat copy updated from the site canonical. ✓");
