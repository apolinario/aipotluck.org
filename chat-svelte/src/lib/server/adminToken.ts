import { config } from "$lib/server/config";
import type { Session } from "$lib/types/Session";
import { logger } from "./logger";
import { v4 } from "uuid";

// Durable admin proof cookie. The in-memory `adminSessions` array below only works on a single
// long-lived process (upstream chat-ui's assumption); on Vercel serverless each function instance
// has its own memory, so an admin grant registered on instance A is invisible to instance B and the
// admin gate 403s intermittently. This cookie is a STATELESS, instance-independent proof: an
// HMAC(ADMIN_TOKEN, sessionId) that only a holder of ADMIN_TOKEN could mint, bound to one session so
// it can't be replayed against another. Read on every request to derive isAdmin.
export const ADMIN_PROOF_COOKIE = "admin-proof";

const hex = (buf: ArrayBuffer) =>
	Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

async function hmacSha256(key: string, message: string): Promise<string> {
	const enc = new TextEncoder();
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		enc.encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	return hex(await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message)));
}

// Constant-time compare for equal-length hex strings — avoids leaking the proof via timing.
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

class AdminTokenManager {
	private token = config.ADMIN_TOKEN || v4();
	// contains all session ids that are currently admin sessions (same-instance fast path only —
	// the durable cross-instance grant is the ADMIN_PROOF_COOKIE; see makeProof / verifyProof)
	private adminSessions: Array<Session["sessionId"]> = [];

	public get enabled() {
		// if open id is configured, disable the feature
		return config.ADMIN_CLI_LOGIN === "true";
	}
	public isAdmin(sessionId: Session["sessionId"]) {
		if (!this.enabled) return false;
		return this.adminSessions.includes(sessionId);
	}

	// HMAC key for the proof cookie. config.ADMIN_TOKEN is set in prod (stable across instances and
	// restarts → proofs stay valid); in dev it falls back to the per-process random token (fine, dev
	// is single-process). Rotating ADMIN_TOKEN invalidates outstanding proofs, which is correct.
	private proofKey(): string {
		return config.ADMIN_TOKEN || this.token;
	}

	/** Mint the durable admin proof for a session (set as ADMIN_PROOF_COOKIE on token validation). */
	public makeProof(sessionId: Session["sessionId"]): Promise<string> {
		return hmacSha256(this.proofKey(), sessionId);
	}

	/** Verify an admin-proof cookie against the current session. Stateless — no instance memory. */
	public async verifyProof(
		proof: string | undefined,
		sessionId: Session["sessionId"] | undefined
	): Promise<boolean> {
		if (!this.enabled || !proof || !sessionId) return false;
		return timingSafeEqual(proof, await this.makeProof(sessionId));
	}

	public checkToken(token: string, sessionId: Session["sessionId"]) {
		if (!this.enabled) return false;
		if (token === this.token) {
			logger.info(`[ADMIN] Token validated`);
			this.adminSessions.push(sessionId);
			this.token = config.ADMIN_TOKEN || v4();
			return true;
		}

		return false;
	}

	public removeSession(sessionId: Session["sessionId"]) {
		this.adminSessions = this.adminSessions.filter((id) => id !== sessionId);
	}

	public displayToken() {
		// if admin token is set, don't display it
		if (!this.enabled || config.ADMIN_TOKEN) return;

		let port = process.env.PORT
			? parseInt(process.env.PORT)
			: process.argv.includes("--port")
				? parseInt(process.argv[process.argv.indexOf("--port") + 1])
				: undefined;

		if (!port) {
			const mode = process.argv.find((arg) => arg === "preview" || arg === "dev");
			if (mode === "preview") {
				port = 4173;
			} else if (mode === "dev") {
				port = 5173;
			} else {
				port = 3000;
			}
		}

		const url = (config.PUBLIC_ORIGIN || `http://localhost:${port}`) + "?token=";
		logger.info(`[ADMIN] You can login with ${url + this.token}`);
	}
}

export const adminTokenManager = new AdminTokenManager();
