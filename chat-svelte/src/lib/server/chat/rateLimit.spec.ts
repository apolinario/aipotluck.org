import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB seam + config so we can drive the fail-open / over-limit branches deterministically.
// vi.hoisted lets the mock factories (hoisted above imports) share these handles with the tests.
const { insertOne, countDocuments, mockUsageLimits, mockConfig, hashIp } = vi.hoisted(() => ({
	insertOne: vi.fn(),
	countDocuments: vi.fn(),
	mockUsageLimits: { messagesPerMinute: 5 } as { messagesPerMinute?: number },
	mockConfig: { GLOBAL_DAILY_REQUEST_CAP: "0", RATE_LIMIT_IP_MULTIPLIER: "0" } as Record<
		string,
		string
	>,
	hashIp: vi.fn(() => "iphash"),
}));

vi.mock("$lib/server/database", () => ({
	collections: { messageEvents: { insertOne, countDocuments } },
}));
vi.mock("$lib/server/usageLimits", () => ({ usageLimits: mockUsageLimits }));
vi.mock("$lib/server/config", () => ({ config: mockConfig }));
vi.mock("$lib/server/db/ipHash", () => ({ hashIp }));
vi.mock("$lib/stores/errors", () => ({ ERROR_MESSAGES: { rateLimited: "rate limited" } }));
vi.mock("$lib/server/logger.js", () => ({
	logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { enforceRequestRateLimits } from "./rateLimit";

const OPTS = { userId: "session-1", clientAddress: "203.0.113.7" };

beforeEach(() => {
	insertOne.mockReset().mockResolvedValue(undefined);
	countDocuments.mockReset().mockResolvedValue(0);
	hashIp.mockReset().mockReturnValue("iphash");
	mockUsageLimits.messagesPerMinute = 5;
	mockConfig.GLOBAL_DAILY_REQUEST_CAP = "0";
	mockConfig.RATE_LIMIT_IP_MULTIPLIER = "0";
});

describe("enforceRequestRateLimits", () => {
	it("records the turn and resolves when under the per-session limit", async () => {
		countDocuments.mockResolvedValue(1); // 1 ≤ 5
		await expect(enforceRequestRateLimits(OPTS)).resolves.toBeUndefined();
		expect(insertOne).toHaveBeenCalledTimes(1); // the per-message event
	});

	it("throws 429 when the per-session count exceeds the limit", async () => {
		countDocuments.mockResolvedValue(6); // 6 > 5
		await expect(enforceRequestRateLimits(OPTS)).rejects.toMatchObject({ status: 429 });
	});

	it("FAILS OPEN when the event insert throws (must not 500 the turn)", async () => {
		insertOne.mockRejectedValue(new Error("db down"));
		countDocuments.mockResolvedValue(0);
		await expect(enforceRequestRateLimits(OPTS)).resolves.toBeUndefined();
	});

	it("FAILS OPEN when the per-session count query throws", async () => {
		countDocuments.mockRejectedValue(new Error("db blip"));
		// null count → no throw even though we couldn't verify the limit
		await expect(enforceRequestRateLimits(OPTS)).resolves.toBeUndefined();
	});

	it("skips all limits (no count) when messagesPerMinute is unset", async () => {
		mockUsageLimits.messagesPerMinute = undefined;
		await expect(enforceRequestRateLimits(OPTS)).resolves.toBeUndefined();
		expect(countDocuments).not.toHaveBeenCalled();
	});

	it("throws 429 when the global daily cap is reached", async () => {
		mockConfig.GLOBAL_DAILY_REQUEST_CAP = "10";
		countDocuments
			.mockResolvedValueOnce(0) // per-session: under limit
			.mockResolvedValueOnce(10); // global daily: at the cap (>= → throw)
		await expect(enforceRequestRateLimits(OPTS)).rejects.toMatchObject({ status: 429 });
	});

	it("enforces the opt-in per-IP ceiling only when a multiplier and a hash are present", async () => {
		mockConfig.RATE_LIMIT_IP_MULTIPLIER = "2"; // ceiling = 5 * 2 = 10
		countDocuments
			.mockResolvedValueOnce(3) // per-session: under 5
			.mockResolvedValueOnce(11); // per-IP: over 10 → throw
		await expect(enforceRequestRateLimits(OPTS)).rejects.toMatchObject({ status: 429 });
	});

	it("skips the per-IP ceiling when no pepper is configured (hashIp returns null)", async () => {
		mockConfig.RATE_LIMIT_IP_MULTIPLIER = "2";
		hashIp.mockReturnValue(null as unknown as string);
		countDocuments.mockResolvedValue(3); // per-session only; per-IP must be skipped
		await expect(enforceRequestRateLimits(OPTS)).resolves.toBeUndefined();
		expect(countDocuments).toHaveBeenCalledTimes(1); // per-session only, no per-IP count
	});
});
