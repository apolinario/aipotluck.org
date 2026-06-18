/**
 * Lazy Drizzle client over postgres.js. Lazy so import-time has no side effects
 * (serverless-friendly: no eager connect at module load — unlike the Mongo `ready` IIFE
 * in database.ts that this migration removes).
 *
 * postgres.js works for both local Postgres and Neon. On Neon serverless use a pooled
 * connection string (…-pooler.neon.tech) or @neondatabase/serverless; the API is the same.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let _sql: ReturnType<typeof postgres> | undefined;

function databaseUrl(): string {
	// DATABASE_URL is canonical. On Vercel the Neon integration provisions POSTGRES_URL
	// (the pooled endpoint, correct for serverless with prepare:false below), so fall back
	// to it — lets the app reuse the integration's variable without copying the secret into
	// a second name.
	const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
	if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");
	return url;
}

export function getDb() {
	if (!_db) {
		_sql = postgres(databaseUrl(), {
			// Serverless: keep the pool small; one connection per function instance.
			max: Number(process.env.PG_POOL_MAX ?? 1),
			prepare: false,
			// Cold starts hit the Neon pooler before it's warm; the default connect timeout
			// was tripping (write CONNECT_TIMEOUT …-pooler.neon.tech) on the first query of a
			// fresh function. Give the handshake real runway, and reap idle sockets so a frozen
			// serverless instance doesn't hold a pooler slot.
			connect_timeout: Number(process.env.PG_CONNECT_TIMEOUT ?? 30),
			idle_timeout: Number(process.env.PG_IDLE_TIMEOUT ?? 20),
		});
		_db = drizzle(_sql, { schema });
	}
	return _db;
}

export async function closeDb() {
	await _sql?.end({ timeout: 5 });
	_sql = undefined;
	_db = undefined;
}

export { schema };
