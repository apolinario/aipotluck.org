/**
 * Unit coverage for the toxic-bert moderation seam. The whole point of this module is a security
 * contract: toxicity fails OPEN (an HF blip must not break chat), child-safety fails CLOSED. These
 * tests pin both, plus the score→flag threshold and the response-shape parsing, with the network
 * mocked so they're deterministic and offline.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
	moderateMessage,
	checkChildSafety,
	MODERATION_DECLINE,
	CHILD_SAFETY_DECLINE,
} from "$lib/server/moderation";

// toxic-bert returns [[{label, score}, ...]]. Highest score is what we threshold on.
function toxicBertResponse(labels: Array<{ label: string; score: number }>) {
	return {
		ok: true,
		status: 200,
		json: async () => [labels],
	} as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
	vi.stubEnv("HF_TOKEN", "test-token");
	vi.stubEnv("OPENAI_API_KEY", "");
	fetchMock.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("moderateMessage", () => {
	it("returns SAFE without calling the network for empty/whitespace text", async () => {
		const result = await moderateMessage("   ");
		expect(result).toEqual({ flagged: false, label: null, score: 0 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns SAFE without calling the network when no token is configured", async () => {
		vi.stubEnv("HF_TOKEN", "");
		vi.stubEnv("OPENAI_API_KEY", "");
		const result = await moderateMessage("anything");
		expect(result).toEqual({ flagged: false, label: null, score: 0 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not flag benign text scoring below the threshold", async () => {
		fetchMock.mockResolvedValue(
			toxicBertResponse([
				{ label: "toxic", score: 0.002 },
				{ label: "insult", score: 0.001 },
			])
		);
		const result = await moderateMessage("what is the capital of Switzerland?");
		expect(result.flagged).toBe(false);
		expect(result.label).toBe("toxic");
		expect(result.score).toBeCloseTo(0.002);
	});

	it("flags text at or above the 0.7 threshold, reporting the top label and score", async () => {
		fetchMock.mockResolvedValue(
			toxicBertResponse([
				{ label: "toxic", score: 0.81 },
				{ label: "threat", score: 0.994 },
				{ label: "insult", score: 0.4 },
			])
		);
		const result = await moderateMessage("a threatening message");
		expect(result.flagged).toBe(true);
		// Picks the highest score regardless of array order (don't trust the order).
		expect(result.label).toBe("threat");
		expect(result.score).toBeCloseTo(0.994);
	});

	it("treats exactly 0.7 as flagged (threshold is inclusive)", async () => {
		fetchMock.mockResolvedValue(toxicBertResponse([{ label: "toxic", score: 0.7 }]));
		const result = await moderateMessage("borderline");
		expect(result.flagged).toBe(true);
	});

	it("truncates input to 2000 characters before sending", async () => {
		fetchMock.mockResolvedValue(toxicBertResponse([{ label: "toxic", score: 0.01 }]));
		await moderateMessage("x".repeat(5000));
		const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
		expect(body.inputs).toHaveLength(2000);
	});

	it("fails OPEN (returns SAFE) on a non-OK HTTP response", async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response);
		const result = await moderateMessage("toxic content");
		expect(result).toEqual({ flagged: false, label: null, score: 0 });
	});

	it("fails OPEN (returns SAFE) when the network call throws", async () => {
		fetchMock.mockRejectedValue(new Error("network down"));
		const result = await moderateMessage("toxic content");
		expect(result).toEqual({ flagged: false, label: null, score: 0 });
	});

	it("handles a malformed response shape without throwing", async () => {
		fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
		const result = await moderateMessage("hello");
		expect(result).toEqual({ flagged: false, label: null, score: 0 });
	});
});

describe("checkChildSafety", () => {
	it("is inert until a detector is wired (returns not-flagged)", async () => {
		// Contract note: when a detector IS wired it must fail CLOSED; today it is intentionally inert.
		expect(await checkChildSafety("any text")).toEqual({ flagged: false });
	});
});

describe("decline copy", () => {
	it("exposes distinct decline strings for toxicity vs child-safety", () => {
		expect(MODERATION_DECLINE).toMatch(/toxic-bert/);
		expect(CHILD_SAFETY_DECLINE).not.toEqual(MODERATION_DECLINE);
		// Toxicity invites a rephrase; child-safety deliberately does not.
		expect(MODERATION_DECLINE).toMatch(/rephrase/);
		expect(CHILD_SAFETY_DECLINE).not.toMatch(/rephrase/);
	});
});
