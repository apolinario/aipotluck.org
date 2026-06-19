/**
 * The one property that matters for the text-only alpha gate: it must DEFAULT OFF. An unset (or
 * typo'd) MULTIMODAL_ENABLED env var must resolve to `false` so every multimodal/file seam stays
 * blocked — fail-safe to text-only, never fail-open. (Test env doesn't set the var.)
 */
import { describe, it, expect } from "vitest";
import { MULTIMODAL_ENABLED } from "./textOnly";

describe("text-only alpha gate", () => {
	it("defaults to blocked (false) when MULTIMODAL_ENABLED is unset", () => {
		expect(MULTIMODAL_ENABLED).toBe(false);
	});
});
