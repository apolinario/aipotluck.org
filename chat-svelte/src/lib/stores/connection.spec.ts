import { describe, it, expect } from "vitest";
import { deriveConnectionState } from "./connection";

const base = { navigatorOnline: true, lastPingAgoMs: 0 as number | null };

describe("deriveConnectionState", () => {
	it("is online when navigator is online and heartbeat is fresh", () => {
		expect(deriveConnectionState({ ...base, lastPingAgoMs: 1000 })).toBe("online");
	});

	it("offline when navigator reports offline, regardless of heartbeat", () => {
		expect(deriveConnectionState({ ...base, navigatorOnline: false, lastPingAgoMs: 0 })).toBe(
			"offline"
		);
	});

	it("reconnecting when heartbeat is stale past the reconnect threshold", () => {
		expect(deriveConnectionState({ ...base, lastPingAgoMs: 9000 })).toBe("reconnecting");
	});

	it("offline when heartbeat is stale past the offline threshold", () => {
		expect(deriveConnectionState({ ...base, lastPingAgoMs: 25000 })).toBe("offline");
	});

	it("does NOT flash reconnecting before the first heartbeat (null age is healthy)", () => {
		expect(deriveConnectionState({ navigatorOnline: true, lastPingAgoMs: null })).toBe("online");
	});

	it("slow on save-data or 2g-class links when otherwise healthy", () => {
		expect(deriveConnectionState({ ...base, lastPingAgoMs: 500, saveData: true })).toBe("slow");
		expect(deriveConnectionState({ ...base, lastPingAgoMs: 500, effectiveType: "slow-2g" })).toBe(
			"slow"
		);
		expect(deriveConnectionState({ ...base, lastPingAgoMs: 500, effectiveType: "2g" })).toBe(
			"slow"
		);
	});

	it("staleness outranks link-quality (reconnecting beats slow)", () => {
		expect(deriveConnectionState({ ...base, lastPingAgoMs: 9000, effectiveType: "slow-2g" })).toBe(
			"reconnecting"
		);
	});

	it("honors custom thresholds", () => {
		expect(
			deriveConnectionState({ ...base, lastPingAgoMs: 3000 }, { reconnectingAfterMs: 2000 })
		).toBe("reconnecting");
	});
});
