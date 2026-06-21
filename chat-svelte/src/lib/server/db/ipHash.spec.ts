import { describe, it, expect, beforeEach, vi } from "vitest";

// Mutable pepper behind a mocked config so we can exercise both the configured and
// unset paths. hashIp reads it via Reflect.get(config, "CONTRIBUTION_IP_PEPPER").
const h = vi.hoisted(() => ({ pepper: "test-pepper-0123456789abcdef" }));
vi.mock("$lib/server/config", () => ({
	config: {
		get CONTRIBUTION_IP_PEPPER() {
			return h.pepper;
		},
	},
}));

import { hashIp } from "./ipHash";

describe("hashIp", () => {
	beforeEach(() => {
		h.pepper = "test-pepper-0123456789abcdef";
	});

	it("never returns the raw IP", () => {
		const ip = "203.0.113.7";
		const out = hashIp(ip);
		expect(out).toBeTruthy();
		expect(out).not.toContain(ip);
		expect(out).not.toBe(ip);
	});

	it("is deterministic — same IP maps to the same hash", () => {
		expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
	});

	it("separates distinct IPs", () => {
		expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
	});

	it("is keyed — a different pepper yields a different hash for the same IP", () => {
		const a = hashIp("203.0.113.7");
		h.pepper = "a-totally-different-pepper-value";
		const b = hashIp("203.0.113.7");
		expect(a).not.toBe(b);
	});

	it("fails toward privacy: no pepper → null (cap disabled, nothing stored)", () => {
		h.pepper = "";
		expect(hashIp("203.0.113.7")).toBeNull();
	});

	it("returns null for empty/whitespace/missing IP", () => {
		expect(hashIp("")).toBeNull();
		expect(hashIp("   ")).toBeNull();
		expect(hashIp(null)).toBeNull();
		expect(hashIp(undefined)).toBeNull();
	});
});
