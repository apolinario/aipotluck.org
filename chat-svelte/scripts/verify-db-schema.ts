/**
 * Loud LIVE-database schema verification — for testing + pre-deploy.
 *
 * Introspects the ACTUAL columns of every table in the live database and diffs them against the
 * Drizzle schema. Catches the failure class `db:drift` cannot: drizzle-kit's journal can mark a
 * migration "applied" while the column is absent (observed 2026-06-20 — the dev DB was missing
 * `message_events.ip_hash`, so every chat turn 500'd silently at the rate-limit insert). `db:drift`
 * only diffs the migration snapshot vs the schema, never the live DB. This one connects to the real
 * database and fails LOUD (exit 1) naming the exact table + column, so drift is caught before a
 * deploy instead of at runtime.
 *
 * Run locally / pre-deploy:  DATABASE_URL=... npm run db:verify
 * CI runs it right after `db:migrate` so a migration that does not yield the expected columns fails
 * the build.
 *
 * Exit codes: 0 = matches, 1 = drift (missing table/column), 2 = could not check (no URL / DB error).
 */
import postgres from "postgres";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "$lib/server/db/schema";

const url =
	process.env.DATABASE_URL ||
	process.env.POSTGRES_URL_NON_POOLING ||
	process.env.POSTGRES_URL ||
	"";

if (!url) {
	console.error("✗ db:verify — DATABASE_URL is not set (nothing to verify).");
	process.exit(2);
}

// Every exported pgTable in the schema (skip enums, relations, helpers).
const tables = Object.values(schema).filter((v): v is PgTable => is(v, PgTable));

const sql = postgres(url, { max: 1 });
let exitCode = 0;
try {
	const rows = await sql<{ table_name: string; column_name: string }[]>`
		select table_name, column_name
		from information_schema.columns
		where table_schema = 'public'
	`;
	// table_name -> set of actual column names in the live DB
	const live = new Map<string, Set<string>>();
	for (const r of rows) {
		const set = live.get(r.table_name) ?? new Set<string>();
		set.add(r.column_name);
		live.set(r.table_name, set);
	}

	let problems = 0;
	for (const table of tables) {
		const cfg = getTableConfig(table);
		const expected = cfg.columns.map((c) => c.name);
		const actual = live.get(cfg.name);
		if (!actual) {
			console.error(`✗ ${cfg.name}: TABLE MISSING from the live database`);
			problems++;
			continue;
		}
		// Only MISSING expected columns break the app (inserts/selects 42703). Extra columns left in
		// the DB (e.g. a renamed-away `ip`) are harmless, so we don't flag them.
		const missing = expected.filter((c) => !actual.has(c));
		if (missing.length > 0) {
			console.error(`✗ ${cfg.name}: missing column(s): ${missing.join(", ")}`);
			problems++;
		} else {
			console.log(`✓ ${cfg.name} (${expected.length} cols)`);
		}
	}

	if (problems > 0) {
		console.error(
			`\n✗ DB SCHEMA DRIFT — ${problems} table(s) do not match the Drizzle schema.\n` +
				`  A migration can be marked applied in the journal while its column is absent.\n` +
				`  Reconcile this database (apply migrations / ALTER) before deploying.`
		);
		exitCode = 1;
	} else {
		console.log(`\n✓ Live DB matches the Drizzle schema — ${tables.length} tables checked.`);
	}
} catch (err) {
	console.error("✗ db:verify — could not introspect the database:", err);
	exitCode = 2;
} finally {
	await sql.end();
}

process.exit(exitCode);
