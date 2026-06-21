/**
 * Database seam — Postgres/Neon via Drizzle, presented through the Mongo-shaped `collections` API the
 * app is built on (B1-lite migration off MongoDB). Each collection is backed by a document-store table
 * (schema.ts) through the adapter in db/mongoAdapter.ts.
 *
 * Serverless posture: `collections` is constructed SYNCHRONOUSLY at import with zero I/O — postgres.js
 * (db/client.ts) connects lazily on the first query. This removes the eager connect-at-import IIFE and
 * the embedded MongoMemoryServer that the upstream MongoDB implementation used, both of which were
 * serverless-hostile. Schema/indexes are applied at deploy time via drizzle-kit, not here.
 */
import { mongoCollection, type CollectionSpec } from "./db/mongoAdapter";
import * as schema from "./db/schema";
import type { Conversation } from "$lib/types/Conversation";
import type { User } from "$lib/types/User";
import type { Session } from "$lib/types/Session";
import type { Settings } from "$lib/types/Settings";
import type { MessageEvent } from "$lib/types/MessageEvent";
import type { AbortedGeneration } from "$lib/types/AbortedGeneration";
import type { Semaphore } from "$lib/types/Semaphore";
import type { TokenCache } from "$lib/types/TokenCache";
import type { ConfigKey } from "$lib/types/ConfigKey";

const text = (prop: string) => ({ prop, kind: "text" as const });
const date = (prop: string) => ({ prop, kind: "date" as const });

const base = { idProp: "id", idField: "_id", emitObjectId: true } satisfies Partial<CollectionSpec>;

export const collections = {
	conversations: mongoCollection<Conversation>({
		...base,
		table: schema.conversations,
		cols: {
			sessionId: text("sessionId"),
			userId: text("userId"),
			createdAt: date("createdAt"),
			updatedAt: date("updatedAt"),
		},
	}),
	users: mongoCollection<User>({
		...base,
		table: schema.users,
		cols: { hfUserId: text("hfUserId"), username: text("username"), createdAt: date("createdAt") },
	}),
	sessions: mongoCollection<Session>({
		...base,
		table: schema.sessions,
		cols: { sessionId: text("sessionId"), userId: text("userId"), expiresAt: date("expiresAt") },
	}),
	settings: mongoCollection<Settings>({
		...base,
		table: schema.settings,
		cols: { userId: text("userId"), sessionId: text("sessionId") },
	}),
	messageEvents: mongoCollection<MessageEvent>({
		...base,
		table: schema.messageEvents,
		cols: {
			userId: text("userId"),
			ipHash: text("ipHash"),
			type: text("type"),
			expiresAt: date("expiresAt"),
			createdAt: date("createdAt"),
		},
	}),
	abortedGenerations: mongoCollection<AbortedGeneration>({
		...base,
		table: schema.abortedGenerations,
		cols: {
			conversationId: text("conversationId"),
			updatedAt: date("updatedAt"),
			createdAt: date("createdAt"),
		},
	}),
	semaphores: mongoCollection<Semaphore>({
		...base,
		table: schema.semaphores,
		cols: { key: text("key"), updatedAt: date("updatedAt"), deleteAt: date("deleteAt") },
	}),
	tokenCaches: mongoCollection<TokenCache>({
		...base,
		table: schema.tokenCaches,
		cols: { tokenHash: text("tokenHash"), userId: text("userId"), createdAt: date("createdAt") },
	}),
	config: mongoCollection<ConfigKey>({
		table: schema.configKv,
		idProp: "key",
		idField: "key",
		emitObjectId: false,
		cols: {},
	}),
};

export type Collections = typeof collections;

/**
 * Back-compat shims for the former Mongo `Database` singleton. `collections` is already populated at
 * import (no async init), so these resolve immediately.
 */
export const ready = Promise.resolve();

export async function getCollectionsEarly(): Promise<Collections> {
	return collections;
}
