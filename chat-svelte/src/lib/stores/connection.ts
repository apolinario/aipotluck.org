// Connectivity state for the flaky-conference-wifi UX layer. The honest signal of "can we
// reach the server" is NOT navigator.onLine (it reports true on captive-portal wifi that
// can't actually reach us) — it's the liveness of our own heartbeat (the /updates SSE
// emits one; the consumer calls notePing() on each). navigator.onLine is used only as a
// fast coarse "offline" hint, never to gate sends. The Network Information API
// (effectiveType/saveData) is progressive enhancement (Chromium/Android-mostly).
//
// The state machine is a PURE reducer (deriveConnectionState) so it's unit-testable with
// no DOM; the store wiring (createConnectionStore) attaches it to browser events + a
// heartbeat staleness timer, with debounce so a sub-second micro-drop never flashes UI.

import { readable, type Readable } from "svelte/store";

export type ConnectionState = "online" | "slow" | "reconnecting" | "offline";

export interface ConnectionInputs {
	/** navigator.onLine (coarse; a false here is trustworthy, a true is not). */
	navigatorOnline: boolean;
	/** ms since the last heartbeat ping, or null if we've never seen one yet. */
	lastPingAgoMs: number | null;
	/** Network Information effectiveType, if available ("slow-2g"|"2g"|"3g"|"4g"). */
	effectiveType?: string | null;
	/** Network Information saveData flag, if available. */
	saveData?: boolean | null;
}

export interface ConnectionThresholds {
	/** Heartbeat silence beyond this (ms) → "reconnecting". Default 8000. */
	reconnectingAfterMs?: number;
	/** Heartbeat silence beyond this (ms) → "offline". Default 20000. */
	offlineAfterMs?: number;
}

/**
 * Pure state derivation. Order matters: hard-offline first, then heartbeat staleness, then
 * link-quality. `lastPingAgoMs === null` (no heartbeat yet) is treated as healthy so a
 * fresh page doesn't flash "reconnecting" before the first ping arrives.
 */
export function deriveConnectionState(
	input: ConnectionInputs,
	thresholds: ConnectionThresholds = {}
): ConnectionState {
	const { reconnectingAfterMs = 8000, offlineAfterMs = 20000 } = thresholds;
	const { navigatorOnline, lastPingAgoMs, effectiveType, saveData } = input;

	if (!navigatorOnline) return "offline";
	if (lastPingAgoMs !== null) {
		if (lastPingAgoMs >= offlineAfterMs) return "offline";
		if (lastPingAgoMs >= reconnectingAfterMs) return "reconnecting";
	}
	if (saveData === true || effectiveType === "slow-2g" || effectiveType === "2g") return "slow";
	return "online";
}

interface ConnectionStoreOptions extends ConnectionThresholds {
	/** Poll cadence for re-deriving from heartbeat age (ms). Default 2000. */
	tickMs?: number;
	/** Debounce before surfacing a non-"online" state (ms), so micro-drops don't flash. Default 1500. */
	debounceMs?: number;
}

/**
 * Browser store. Returns a readable<ConnectionState> plus `notePing()` to call from the
 * heartbeat consumer. SSR-safe: yields "online" and no-ops without a browser.
 */
export function createConnectionStore(opts: ConnectionStoreOptions = {}): {
	state: Readable<ConnectionState>;
	notePing: () => void;
} {
	const { tickMs = 2000, debounceMs = 1500, ...thresholds } = opts;

	if (typeof window === "undefined") {
		return { state: readable<ConnectionState>("online"), notePing: () => {} };
	}

	let lastPing: number | null = null;
	const notePing = () => {
		lastPing = Date.now();
	};

	const inputs = (): ConnectionInputs => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const conn = (navigator as any).connection ?? null;
		return {
			navigatorOnline: navigator.onLine,
			lastPingAgoMs: lastPing === null ? null : Date.now() - lastPing,
			effectiveType: conn?.effectiveType ?? null,
			saveData: conn?.saveData ?? null,
		};
	};

	const state = readable<ConnectionState>("online", (set) => {
		let current: ConnectionState = "online";
		let pendingTimer: ReturnType<typeof setTimeout> | undefined;

		const clearPending = () => {
			if (pendingTimer) {
				clearTimeout(pendingTimer);
				pendingTimer = undefined;
			}
		};

		const apply = (next: ConnectionState) => {
			if (next === current) {
				clearPending();
				return;
			}
			// "online" (recovery) applies immediately; degraded states debounce so a brief
			// blip never flashes the banner.
			if (next === "online") {
				clearPending();
				current = next;
				set(next);
				return;
			}
			if (pendingTimer) return; // already waiting to surface a degraded state
			pendingTimer = setTimeout(() => {
				pendingTimer = undefined;
				current = next;
				set(next);
			}, debounceMs);
		};

		const recompute = () => apply(deriveConnectionState(inputs(), thresholds));

		const onOnline = () => recompute();
		const onOffline = () => recompute();
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		const interval = setInterval(recompute, tickMs);
		recompute();

		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
			clearInterval(interval);
			if (pendingTimer) clearTimeout(pendingTimer);
		};
	});

	return { state, notePing };
}
