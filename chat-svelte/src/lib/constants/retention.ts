/**
 * Conversation data-retention window for the open alpha.
 *
 * SINGLE SOURCE OF TRUTH for both halves of the promise:
 *   - the user-facing claim — /privacy: "guest conversations are automatically deleted after N days"
 *   - the mechanism that makes it true — the TTL sweep in db/cleanup.ts (run by the daily Vercel cron)
 * so the stated window and the actual deletion can never drift.
 *
 * A plain const (not env-sourced) so the client `/privacy` page can import the same value the server
 * sweeps on. Revisit at public launch (likely env-source it alongside a fuller privacy statement).
 */
export const RETENTION_DAYS = 30;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
