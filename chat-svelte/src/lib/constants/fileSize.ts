/**
 * Maximum accepted upload / fetched-file size.
 *
 * SINGLE SOURCE OF TRUTH for the cap and its user-facing label, so the enforced byte limit and
 * every "10MB" string can never drift. Consumed by:
 *   - the server upload gate (conversation POST handler),
 *   - the URL-fetch route (Content-Length + actual-bytes checks),
 *   - the client drop-zone pre-check, and
 *   - the copy in the drop-zone + URL-fetch modal.
 *
 * A plain const (not env-sourced) so client components can import the same value the server enforces.
 * Bump MAX_FILE_SIZE_MB and the byte cap + every label follow automatically.
 */
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = `${MAX_FILE_SIZE_MB}MB`;
