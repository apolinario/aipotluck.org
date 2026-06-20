/**
 * Drizzle schema for the Postgres/Neon persistence layer (B1-lite migration off MongoDB).
 *
 * Strategy: a document store. Each former Mongo collection is a table of `id` (24-hex, ObjectId-width)
 * + the small set of columns it is actually *filtered/sorted* by (for indexes) + a `doc` JSONB column
 * holding the full document. The Mongo-shaped adapter (mongoAdapter.ts) reads/writes `doc` and keeps
 * the projection columns in sync. This lets the entire app — routes, tree utilities, components, and
 * the `_id: ObjectId` types — keep operating unchanged while the storage engine becomes Postgres.
 *
 * Dates and ObjectIds inside `doc` are persisted via an extended-JSON encoding (see mongoAdapter.ts)
 * so they round-trip faithfully anywhere in the document, including nested fields like
 * session.oauth.token.expiresAt.
 *
 * Written from chat-ui's own TypeScript interfaces — NOT copied from any Vercel reference.
 * Kept free of $lib/$app aliases so it is importable by a plain Node verification harness.
 */
import {
	pgTable,
	text,
	jsonb,
	timestamp,
	customType,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// Postgres bytea for binary file payloads (GridFS replacement).
const bytea = customType<{ data: Buffer; default: false }>({
	dataType() {
		return "bytea";
	},
});

type Doc = Record<string, unknown>;

// ── conversations ──────────────────────────────────────────────────────────────
export const conversations = pgTable(
	"conversations",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id"),
		userId: text("user_id"),
		createdAt: timestamp("created_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }),
		doc: jsonb("doc").$type<Doc>().notNull(),
	},
	(t) => [
		index("conversations_session_updated_idx").on(t.sessionId, t.updatedAt.desc()),
		index("conversations_user_updated_idx").on(t.userId, t.updatedAt.desc()),
		// Serves the retention sweep's `updated_at < cutoff` predicate (db/cleanup.ts); the composite
		// indexes above lead with session/user so they can't answer a bare time-range scan.
		index("conversations_updated_idx").on(t.updatedAt),
	]
);

// ── users ────────────────────────────────────────────────────────────────────
export const users = pgTable(
	"users",
	{
		id: text("id").primaryKey(),
		hfUserId: text("hf_user_id"),
		username: text("username"),
		createdAt: timestamp("created_at", { withTimezone: true }),
		doc: jsonb("doc").$type<Doc>().notNull(),
	},
	(t) => [
		uniqueIndex("users_hf_user_id_idx").on(t.hfUserId),
		index("users_username_idx").on(t.username),
	]
);

// ── sessions ─────────────────────────────────────────────────────────────────
export const sessions = pgTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id").notNull(),
		userId: text("user_id"),
		// Postgres has no native TTL; expiry is enforced by query + a cleanup job (replaces Mongo TTL index).
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		doc: jsonb("doc").$type<Doc>().notNull(),
	},
	(t) => [
		uniqueIndex("sessions_session_id_idx").on(t.sessionId),
		index("sessions_expires_idx").on(t.expiresAt),
	]
);

// ── settings ─────────────────────────────────────────────────────────────────
// Wide/volatile shape (many per-model override maps) → kept entirely in `doc`.
export const settings = pgTable(
	"settings",
	{
		id: text("id").primaryKey(),
		userId: text("user_id"),
		sessionId: text("session_id"),
		doc: jsonb("doc").$type<Doc>().notNull(),
	},
	(t) => [
		uniqueIndex("settings_user_idx").on(t.userId),
		uniqueIndex("settings_session_idx").on(t.sessionId),
	]
);

// ── messageEvents (rate-limit / resumable-stream infra) ──────────────────────────
export const messageEvents = pgTable(
	"message_events",
	{
		id: text("id").primaryKey(),
		userId: text("user_id"),
		ip: text("ip"),
		type: text("type"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }),
		doc: jsonb("doc").$type<Doc>().notNull(),
	},
	(t) => [
		index("message_events_user_idx").on(t.userId, t.type, t.expiresAt),
		index("message_events_ip_idx").on(t.ip, t.type, t.expiresAt),
	]
);

// ── abortedGenerations (cross-instance stop marker) ──────────────────────────────
export const abortedGenerations = pgTable(
	"aborted_generations",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id"),
		updatedAt: timestamp("updated_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }),
		doc: jsonb("doc").$type<Doc>().notNull(),
	},
	(t) => [uniqueIndex("aborted_generations_conversation_idx").on(t.conversationId)]
);

// ── semaphores (advisory lock + config-update marker) ────────────────────────────
// `key` is unique: insert throwing on duplicate IS the lock primitive (see dbLock.ts).
export const semaphores = pgTable(
	"semaphores",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }),
		deleteAt: timestamp("delete_at", { withTimezone: true }),
		doc: jsonb("doc").$type<Doc>().notNull(),
	},
	(t) => [uniqueIndex("semaphores_key_idx").on(t.key)]
);

// ── tokenCaches (API bearer-token → user cache, 5-min TTL) ───────────────────────
export const tokenCaches = pgTable(
	"token_caches",
	{
		id: text("id").primaryKey(),
		tokenHash: text("token_hash"),
		userId: text("user_id"),
		createdAt: timestamp("created_at", { withTimezone: true }),
		doc: jsonb("doc").$type<Doc>().notNull(),
	},
	(t) => [index("token_caches_hash_idx").on(t.tokenHash)]
);

// ── config (key/value, ConfigManager) ────────────────────────────────────────────
// Identity is `key` (not `_id`); no ObjectId is emitted on read.
export const configKv = pgTable("config", {
	key: text("key").primaryKey(),
	doc: jsonb("doc").$type<Doc>().notNull(),
});

// ── files (GridFS replacement; bytea payload) ────────────────────────────────────
// Not accessed through the Mongo adapter — see files/uploadFile.ts / downloadFile.ts.
export const files = pgTable(
	"files",
	{
		id: text("id").primaryKey(),
		filename: text("filename").notNull(),
		conversationId: text("conversation_id"),
		mime: text("mime"),
		data: bytea("data").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("files_filename_idx").on(t.filename)]
);

// ── reports (ROOST triage seam — normalized, NOT behind the Mongo adapter) ───────
// The single read/write point a trust-and-safety consumer attaches to. Written by saveReport
// (db/reports.ts). Mirrors the Vercel app's `Report` table adapted to text ids.
export const reports = pgTable(
	"reports",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => conversations.id),
		messageId: text("message_id"),
		userId: text("user_id"),
		sessionId: text("session_id"),
		reason: text("reason", { enum: ["harmful", "inaccurate", "privacy", "other"] }).notNull(),
		detail: text("detail"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("reports_conversation_idx").on(t.conversationId)]
);

export type ReportRow = typeof reports.$inferSelect;
export type NewReportRow = typeof reports.$inferInsert;

// ── contributions ("Get involved" capture) ──────────────────────────────────────
// Public contribution write point — the single place "Stay informed" (subscribe) and
// "Raise your hand" (contribute) submissions land. Written by saveContribution
// (db/contributions.ts). Mirrors the Vercel app's `Contribution` table adapted to text ids,
// plus an `ip` column the Vercel app lacks (it caps per-IP via Redis; chat-svelte has no
// Redis, so the per-IP daily cap is DB-backed — we store ip to count it).
export const contributions = pgTable(
	"contributions",
	{
		id: text("id").primaryKey(),
		kind: text("kind", { enum: ["subscribe", "contribute"] }).notNull(),
		email: text("email").notNull(),
		name: text("name"),
		organization: text("organization"),
		contributionType: text("contribution_type", {
			enum: ["compute", "data", "code", "funding", "other"],
		}),
		detail: text("detail"),
		userId: text("user_id"),
		ip: text("ip"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("contributions_ip_created_idx").on(t.ip, t.createdAt)]
);

export type ContributionRow = typeof contributions.$inferSelect;
export type NewContributionRow = typeof contributions.$inferInsert;
export type FileRow = typeof files.$inferSelect;

// ── generations (W2 idempotency ledger) ──────────────────────────────────────────
// One row per client-minted generationId (the turn's idempotency key). Lets a re-sent POST — a
// network auto-retry of the SAME logical turn (W3) — be deduplicated instead of spawning a parallel
// run. The claim is one statement: INSERT … ON CONFLICT (id) DO UPDATE … WHERE status='error', which
// (a) inserts a fresh row, (b) re-claims a previously-errored row for a new attempt, or (c) no-ops when
// a complete/in-flight row already exists — in case (c) the route returns 409 and the client attaches
// to the existing run rather than double-submitting. Not a document collection (no `doc`/Mongo adapter):
// written via raw drizzle in $lib/server/generations.ts. Pruned alongside conversations (db/cleanup.ts).
export const generations = pgTable(
	"generations",
	{
		id: text("id").primaryKey(), // = client-minted generationId (uuid); the PK IS the idempotency key
		conversationId: text("conversation_id").notNull(),
		messageId: text("message_id"), // assistant message this run wrote (reference)
		status: text("status", { enum: ["in_flight", "complete", "error"] }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(t) => [index("generations_conversation_idx").on(t.conversationId, t.createdAt)]
);

export type GenerationRow = typeof generations.$inferSelect;
