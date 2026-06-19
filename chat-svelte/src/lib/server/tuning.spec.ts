import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB collection so setTuning's read/write hits an in-memory stub.
vi.mock("$lib/server/database", () => ({
	collections: { config: { findOne: vi.fn(async () => null), updateOne: vi.fn(async () => ({})) } },
}));

import { parseTuning, TuningSchema, setTuning } from "./tuning";
import { collections } from "$lib/server/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateOne = vi.mocked((collections as any).config.updateOne);

describe("parseTuning (fail-safe validation)", () => {
	it("accepts a valid partial doc and strips unknown keys (e.g. the row key)", () => {
		const out = parseTuning({
			key: "TUNING",
			persona: "You are a calm machine. You run on {model} by {maker}.",
			decoding: { temperature: 0.2, max_tokens: 400 },
			starters: ["What changed this week?"],
			editedBy: "laura",
			editedAt: "2026-06-18T00:00:00.000Z",
		});
		expect(out.persona).toContain("{model}");
		expect(out.decoding).toEqual({ temperature: 0.2, max_tokens: 400 });
		expect(out.starters).toEqual(["What changed this week?"]);
		expect(out).not.toHaveProperty("key");
	});

	it("returns {} (→ code defaults) for missing/null input", () => {
		expect(parseTuning(undefined)).toEqual({});
		expect(parseTuning(null)).toEqual({});
		expect(parseTuning({})).toEqual({});
	});

	it("fails safe to {} when a field is the wrong type", () => {
		expect(parseTuning({ persona: 123 })).toEqual({});
		expect(parseTuning({ starters: "not-an-array" })).toEqual({});
	});

	it("rejects out-of-range decoding values (fails safe to {})", () => {
		expect(parseTuning({ decoding: { temperature: 9 } })).toEqual({});
		expect(parseTuning({ decoding: { max_tokens: 0 } })).toEqual({});
	});

	it("caps starters count and rejects empty strings", () => {
		expect(parseTuning({ starters: Array(20).fill("x") })).toEqual({});
		expect(parseTuning({ starters: [""] })).toEqual({});
	});

	it("each field is independently optional", () => {
		expect(TuningSchema.safeParse({ grounding: "Cite [n]." }).success).toBe(true);
		expect(TuningSchema.safeParse({ decoding: { presence_penalty: 0.5 } }).success).toBe(true);
	});
});

describe("setTuning (writes reject invalid — never silently wipe)", () => {
	beforeEach(() => updateOne.mockClear());

	it("persists a valid doc and stamps editedBy/editedAt", async () => {
		const out = await setTuning({ persona: "Hi {model}.", decoding: { temperature: 0.3 } }, "laura");
		expect(out.persona).toBe("Hi {model}.");
		expect(out.editedBy).toBe("laura");
		expect(out.editedAt).toBeTruthy();
		expect(updateOne).toHaveBeenCalledOnce();
	});

	it("THROWS on an out-of-range field and does NOT write (no silent wipe)", async () => {
		await expect(setTuning({ decoding: { temperature: 9 } }, "laura")).rejects.toThrow();
		expect(updateOne).not.toHaveBeenCalled();
	});

	it("THROWS on a wrong-typed field rather than dropping all overrides", async () => {
		// @ts-expect-error — deliberately invalid input (simulates a non-form POST)
		await expect(setTuning({ persona: 123 }, "laura")).rejects.toThrow();
		expect(updateOne).not.toHaveBeenCalled();
	});
});
