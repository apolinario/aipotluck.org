import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

// Drift guard: the chat's grounding catalog is a vendored copy of the site's
// canonical `app/public/data/categories.json` (chat-svelte deploys from its own
// dir and can't import the sibling at build time, so it commits a copy). The
// gap-map data is re-audited on the site side; without this guard the chat copy
// silently drifts and the model grounds against a stale taxonomy. If they ever
// differ, this test goes red and `npm run sync:categories` is the one-command fix.
//
// In a standalone chat-svelte checkout (outside the monorepo) the canonical file
// isn't present — there is nothing to drift from, so the guard skips rather than
// failing a fork that legitimately has no site to track.

const here = dirname(fileURLToPath(import.meta.url));
const CHAT_COPY = resolve(here, "categories.json");
const CANONICAL = resolve(here, "../../../../../../app/public/data/categories.json");

describe("categories.json site sync", () => {
	it("is byte-identical to the site's canonical app/public/data/categories.json", () => {
		if (!existsSync(CANONICAL)) {
			// Standalone checkout — no site canonical to track. Not a drift.
			expect(existsSync(CHAT_COPY)).toBe(true);
			return;
		}
		const canonical = readFileSync(CANONICAL);
		const chatCopy = readFileSync(CHAT_COPY);
		expect(
			chatCopy.equals(canonical),
			"chat categories.json drifted from app/public/data/categories.json — run `npm run sync:categories`"
		).toBe(true);
	});
});
