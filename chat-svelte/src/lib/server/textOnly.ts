import { config } from "$lib/server/config";

/**
 * TEXT-ONLY ALPHA ENFORCEMENT (until July 9, 2026).
 *
 * Every multimodal / file I/O path — image+file upload, file download, voice/audio input — is
 * BLOCKED at the SERVER, not merely hidden in the UI, for safety. Hiding a button is not
 * enforcement: a crafted request could still upload a file or post an image, so each seam checks
 * this flag and rejects.
 *
 * This is a GATE, not a removal. The upload / vision / voice / download code paths are all still
 * present; flipping `MULTIMODAL_ENABLED=true` in the env re-enables them post-July with no rebuild.
 *
 * Default OFF: an unset env var → blocked, so a forgotten/typo'd flag FAILS SAFE to text-only.
 * Read via Reflect.get because the key isn't in the committed .env (avoids the ConfigProxy
 * typecheck error on unset keys — same pattern as SPACE_MCP_URL / MODEL_ALLOWLIST).
 */
export const MULTIMODAL_ENABLED =
	String(Reflect.get(config, "MULTIMODAL_ENABLED") ?? "")
		.trim()
		.toLowerCase() === "true";
