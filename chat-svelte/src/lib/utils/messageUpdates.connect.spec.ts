/**
 * W3 connect-timeout + pre-first-byte jittered retry (connectWithRetry).
 *
 * The contract under test:
 *   - a clean connect returns the Response on the first try (no retry)
 *   - a network-layer fetch throw (TypeError) retries, then succeeds
 *   - a connect that hangs past the timeout is aborted and retried
 *   - retries are bounded by `attempts`; the last error propagates
 *   - a CALLER abort (user Stop / TTFT watchdog / navigation) is NEVER retried —
 *     not before the attempt, not mid-attempt
 *   - any Response (incl. 409 / 5xx) is returned as-is — only thrown CONNECT-class
 *     failures retry; HTTP status is the caller's to handle
 *
 * Determinism: backoff sleep is a no-op and the RNG is pinned to 0, so no real wall-clock
 * delay; the connect-timeout uses a tiny real timeoutMs where a hang must be exercised.
 */
import { describe, expect, it, vi } from "vitest";
import { connectWithRetry } from "./messageUpdates";

const noSleep = async () => {};
const zeroRng = () => 0;

/** A fetch that never settles until its signal aborts, then rejects AbortError (models a hung connect).
 *  Mirrors real fetch: an already-aborted signal rejects synchronously. */
const rejectOnAbort = (signal?: AbortSignal | null) =>
	new Promise<Response>((_resolve, reject) => {
		const fail = () => reject(new DOMException("Aborted", "AbortError"));
		if (signal?.aborted) return fail();
		signal?.addEventListener("abort", fail);
	});
const hangingFetch = (): typeof fetch =>
	((_url: string, init?: RequestInit) => rejectOnAbort(init?.signal)) as unknown as typeof fetch;

describe("connectWithRetry", () => {
	it("returns the response on a clean first connect (no retry)", async () => {
		const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
		const res = await connectWithRetry("/c/1", { method: "POST" }, new AbortController().signal, {
			fetchImpl,
			sleep: noSleep,
			random: zeroRng,
		});
		expect(res.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("retries a network-layer throw (TypeError) then succeeds", async () => {
		let n = 0;
		const fetchImpl = vi.fn(async () => {
			if (n++ === 0) throw new TypeError("Failed to fetch");
			return new Response("ok", { status: 200 });
		});
		const res = await connectWithRetry("/c/1", { method: "POST" }, new AbortController().signal, {
			fetchImpl,
			sleep: noSleep,
			random: zeroRng,
		});
		expect(res.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it("aborts a hung connect at the timeout and retries", async () => {
		let n = 0;
		const hung = hangingFetch();
		const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
			if (n++ === 0) return hung(url, init);
			return Promise.resolve(new Response("ok", { status: 200 }));
		}) as unknown as typeof fetch;
		const res = await connectWithRetry("/c/1", { method: "POST" }, new AbortController().signal, {
			fetchImpl,
			timeoutMs: 5,
			sleep: noSleep,
			random: zeroRng,
		});
		expect(res.status).toBe(200);
		expect(n).toBe(2);
	});

	it("propagates the last error once attempts are exhausted", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		await expect(
			connectWithRetry("/c/1", { method: "POST" }, new AbortController().signal, {
				fetchImpl,
				attempts: 3,
				sleep: noSleep,
				random: zeroRng,
			})
		).rejects.toThrow(TypeError);
		expect(fetchImpl).toHaveBeenCalledTimes(3);
	});

	it("never connects when the caller already aborted", async () => {
		const ctrl = new AbortController();
		ctrl.abort();
		const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
		await expect(
			connectWithRetry("/c/1", { method: "POST" }, ctrl.signal, {
				fetchImpl,
				sleep: noSleep,
				random: zeroRng,
			})
		).rejects.toBeInstanceOf(DOMException);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("does NOT retry when the caller aborts mid-connect (a user Stop, not a flaky link)", async () => {
		const ctrl = new AbortController();
		const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
			// Simulate the user hitting Stop while the request is in flight.
			ctrl.abort();
			return rejectOnAbort(init?.signal);
		}) as unknown as typeof fetch;
		await expect(
			connectWithRetry("/c/1", { method: "POST" }, ctrl.signal, {
				fetchImpl,
				sleep: noSleep,
				random: zeroRng,
			})
		).rejects.toBeInstanceOf(DOMException);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("returns an HTTP error response as-is without retrying (status is the caller's to handle)", async () => {
		const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
		const res = await connectWithRetry("/c/1", { method: "POST" }, new AbortController().signal, {
			fetchImpl,
			sleep: noSleep,
			random: zeroRng,
		});
		expect(res.status).toBe(500);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});
