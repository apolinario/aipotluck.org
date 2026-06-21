import { createHmac } from "crypto";
import { config } from "$lib/server/config";

// Pseudonymise a client IP for the "Get involved" per-IP daily cap. We NEVER persist a raw IP:
// an IP is personal data (GDPR Art. 4 / EDPB), and Public AI treats privacy as first-class —
// the org's stance is hard guarantees over obscurity, so the stored value is designed to reveal
// nothing at rest even to someone holding the database.
//
// HMAC-SHA256 keyed by a server-side secret pepper (CONTRIBUTION_IP_PEPPER):
//   • non-reversible — you cannot read an IP back out of the hash;
//   • non-correlatable without the secret — the IPv4 space is only 2^32, small enough that a
//     PLAIN (unkeyed) hash is brute-forceable in minutes, so the secret key is what actually
//     protects it. Rotating the pepper invalidates all stored hashes (a feature, not a bug);
//   • stable — the same IP maps to the same hash, so the daily COUNT still groups a repeat
//     submitter without ever knowing who they are.
//
// FAIL TOWARD PRIVACY: with no pepper configured we return null rather than store a weakly-keyed
// (brute-forceable) hash. That degrades the per-IP cap to a no-op — which already fails OPEN by
// design (see /api/contribute) — and is the correct trade for an org that ranks privacy over
// abuse-friction. Set CONTRIBUTION_IP_PEPPER to 32+ random bytes in any deploy that wants the cap
// enforced. (Read via Reflect.get so it needs no entry in the committed .env, mirroring the other
// deploy-only knobs like SEARCH_MARGIN_THRESHOLD.)
let warnedNoPepper = false;

export function hashIp(ip: string | null | undefined): string | null {
	const raw = (ip ?? "").trim();
	if (!raw) return null;
	const pepper = ((Reflect.get(config, "CONTRIBUTION_IP_PEPPER") as string | undefined) ?? "").trim();
	if (!pepper) {
		if (!warnedNoPepper) {
			console.warn(
				"[contribute] CONTRIBUTION_IP_PEPPER unset — per-IP rate-limit DISABLED (no IP-derived value stored)"
			);
			warnedNoPepper = true;
		}
		return null;
	}
	return createHmac("sha256", pepper).update(raw).digest("base64url");
}
