import { createHmac } from "crypto";
import { config } from "$lib/server/config";

// Pseudonymise a client IP before it is ever persisted (the "Get involved" per-IP daily cap AND the
// per-IP rate-limit events). We NEVER persist a raw IP: an IP is personal data (GDPR Art. 4 / EDPB),
// and Public AI treats privacy as first-class — the org's stance is hard guarantees over obscurity,
// so the stored value is designed to reveal nothing at rest even to someone holding the database.
//
// HMAC-SHA256 keyed by a server-side secret pepper (CONTRIBUTION_IP_PEPPER — one secret peppers all
// client-IP hashing app-wide; the name predates the second use-site):
//   • non-reversible — you cannot read an IP back out of the hash;
//   • non-correlatable without the secret — the IPv4 space is only 2^32, small enough that a
//     PLAIN (unkeyed) hash is brute-forceable in minutes, so the secret key is what actually
//     protects it. Rotating the pepper invalidates all stored hashes (a feature, not a bug);
//   • stable — the same IP maps to the same hash, so a daily COUNT still groups a repeat
//     submitter without ever knowing who they are.
//
// DOMAIN SEPARATION: the `domain` label is folded into the HMAC input so the SAME IP yields a
// DIFFERENT hash per use-site ("contribution" vs "rate-limit"). This stops anyone with DB read
// access from joining an identified contribution row (it carries email/name) to that person's
// chat rate-limit events by matching equal IP hashes — a real (if minor) deanonymisation vector
// that one shared hash would open. One secret, per-purpose outputs.
//
// FAIL TOWARD PRIVACY: with no pepper configured we return null rather than store a weakly-keyed
// (brute-forceable) hash. That degrades the per-IP cap to a no-op — which already fails OPEN by
// design (see /api/contribute and the rate-limiter) — and is the correct trade for an org that
// ranks privacy over abuse-friction. Set CONTRIBUTION_IP_PEPPER to 32+ random bytes in any deploy
// that wants the caps enforced. (Read via Reflect.get so it needs no entry in the committed .env,
// mirroring the other deploy-only knobs like SEARCH_MARGIN_THRESHOLD.)
let warnedNoPepper = false;

export function hashIp(
	ip: string | null | undefined,
	domain: "contribution" | "rate-limit" = "contribution"
): string | null {
	const raw = (ip ?? "").trim();
	if (!raw) return null;
	const pepper = ((Reflect.get(config, "CONTRIBUTION_IP_PEPPER") as string | undefined) ?? "").trim();
	if (!pepper) {
		if (!warnedNoPepper) {
			console.warn(
				"[ip-hash] CONTRIBUTION_IP_PEPPER unset — per-IP caps DISABLED (no IP-derived value stored)"
			);
			warnedNoPepper = true;
		}
		return null;
	}
	// `domain:` prefix is the separator; ":" cannot appear in an IP literal so the encoding is
	// unambiguous (no two (domain, ip) pairs collide on the HMAC input).
	return createHmac("sha256", pepper).update(`${domain}:${raw}`).digest("base64url");
}
