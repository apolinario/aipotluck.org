/**
 * Verification harness for the TTL garbage collector (src/lib/server/db/cleanup.ts).
 *
 *   DATABASE_URL=postgres://postgres:postgres@localhost:55432/chatui npx -y tsx scripts/verify-cleanup.ts
 *
 * Seeds, through the same Mongo-shaped adapter the runtime uses, an EXPIRED + a FRESH row in each of the
 * five GC'd tables (plus a NULL-expiry semaphore that must survive), runs cleanupExpired(), and asserts
 * the expired rows are gone and the fresh ones remain. No cloud, no HF calls. Cleans up its own fresh
 * seeds at the end so re-runs stay deterministic. All test rows are tagged with a unique run id so this
 * never touches real data.
 */
import { ObjectId } from "bson";
import { eq } from "drizzle-orm";
import { collections } from "../src/lib/server/database.ts";
import { cleanupExpired } from "../src/lib/server/db/cleanup.ts";
import { getDb, closeDb } from "../src/lib/server/db/client.ts";
import * as schema from "../src/lib/server/db/schema.ts";

let failures = 0;
function check(name: string, cond: boolean) {
	console.log(`${cond ? "  ok " : "FAIL "} ${name}`);
	if (!cond) failures++;
}

async function main() {
	const run = new ObjectId().toHexString().slice(-8);
	const now = Date.now();
	const past = (ms: number) => new Date(now - ms);
	const future = (ms: number) => new Date(now + ms);
	const MIN = 60_000;
	const HOUR = 60 * MIN;

	// ── seed: { expiredId, freshId } per table ───────────────────────────────────
	const ids = {
		sessExpired: new ObjectId(),
		sessFresh: new ObjectId(),
		meExpired: new ObjectId(),
		meFresh: new ObjectId(),
		semExpired: new ObjectId(),
		semFresh: new ObjectId(),
		semActive: new ObjectId(), // deleteAt NULL — an in-flight lock, must survive
		tcExpired: new ObjectId(),
		tcFresh: new ObjectId(),
		agExpired: new ObjectId(),
		agFresh: new ObjectId(),
	};

	await collections.sessions.insertOne({
		_id: ids.sessExpired,
		sessionId: `s-exp-${run}`,
		expiresAt: past(MIN),
		createdAt: past(HOUR),
	});
	await collections.sessions.insertOne({
		_id: ids.sessFresh,
		sessionId: `s-fresh-${run}`,
		expiresAt: future(HOUR),
		createdAt: past(MIN),
	});

	await collections.messageEvents.insertOne({
		_id: ids.meExpired,
		type: `t-${run}`,
		expiresAt: past(MIN),
		createdAt: past(HOUR),
	});
	await collections.messageEvents.insertOne({
		_id: ids.meFresh,
		type: `t-${run}`,
		expiresAt: future(HOUR),
		createdAt: past(MIN),
	});

	await collections.semaphores.insertOne({
		_id: ids.semExpired,
		key: `k-exp-${run}`,
		deleteAt: past(MIN),
		updatedAt: past(MIN),
	});
	await collections.semaphores.insertOne({
		_id: ids.semFresh,
		key: `k-fresh-${run}`,
		deleteAt: future(HOUR),
		updatedAt: past(MIN),
	});
	await collections.semaphores.insertOne({
		_id: ids.semActive,
		key: `k-active-${run}`,
		updatedAt: past(MIN),
	}); // no deleteAt

	await collections.tokenCaches.insertOne({
		_id: ids.tcExpired,
		tokenHash: `h-exp-${run}`,
		createdAt: past(6 * MIN),
	}); // > 5min → GC
	await collections.tokenCaches.insertOne({
		_id: ids.tcFresh,
		tokenHash: `h-fresh-${run}`,
		createdAt: past(MIN),
	}); // < 5min → keep

	await collections.abortedGenerations.insertOne({
		_id: ids.agExpired,
		conversationId: new ObjectId(),
		updatedAt: past(2 * HOUR),
		createdAt: past(2 * HOUR),
	}); // > 1h → GC
	await collections.abortedGenerations.insertOne({
		_id: ids.agFresh,
		conversationId: new ObjectId(),
		updatedAt: past(MIN),
		createdAt: past(MIN),
	}); // < 1h → keep

	// ── run ──────────────────────────────────────────────────────────────────────
	// conversation retention (the /privacy promise) — seeded directly, since reports/files aren't
	// behind the Mongo adapter. The EXPIRED conversation carries a report (NOT NULL FK to
	// conversations.id) and a file; if cleanup deleted the conversation WITHOUT removing those first,
	// the FK delete would throw — so this also proves the reports → files → conversations ordering.
	const db = getDb();
	const DAY = 24 * HOUR;
	const convExpired = new ObjectId().toHexString();
	const convFresh = new ObjectId().toHexString();
	const reportExpired = new ObjectId().toHexString();
	const fileExpired = new ObjectId().toHexString();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const doc = (t: string) => ({ title: t }) as any;
	await db.insert(schema.conversations).values({
		id: convExpired,
		sessionId: `c-exp-${run}`,
		createdAt: past(40 * DAY),
		updatedAt: past(40 * DAY), // older than RETENTION_DAYS → swept
		doc: doc(`exp-${run}`),
	});
	await db.insert(schema.conversations).values({
		id: convFresh,
		sessionId: `c-fresh-${run}`,
		createdAt: past(MIN),
		updatedAt: past(MIN), // recent → kept
		doc: doc(`fresh-${run}`),
	});
	await db.insert(schema.reports).values({
		id: reportExpired,
		conversationId: convExpired,
		reason: "other",
		createdAt: past(40 * DAY),
	});
	await db.insert(schema.files).values({
		id: fileExpired,
		filename: `f-${run}.txt`,
		conversationId: convExpired,
		mime: "text/plain",
		data: Buffer.from("x"),
		createdAt: past(40 * DAY),
	});

	const counts = await cleanupExpired();
	console.log("deleted:", JSON.stringify(counts));
	check(
		"reported ≥1 delete per table",
		counts.sessions >= 1 &&
			counts.messageEvents >= 1 &&
			counts.semaphores >= 1 &&
			counts.tokenCaches >= 1 &&
			counts.abortedGenerations >= 1 &&
			counts.conversations >= 1
	);

	// ── assert: expired gone, fresh kept ──────────────────────────────────────────
	const gone = async (col: keyof typeof collections, id: ObjectId) =>
		!(await collections[col].findOne({ _id: id }));
	const kept = async (col: keyof typeof collections, id: ObjectId) =>
		!!(await collections[col].findOne({ _id: id }));

	check("sessions: expired deleted", await gone("sessions", ids.sessExpired));
	check("sessions: fresh kept", await kept("sessions", ids.sessFresh));
	check("messageEvents: expired deleted", await gone("messageEvents", ids.meExpired));
	check("messageEvents: fresh kept", await kept("messageEvents", ids.meFresh));
	check("semaphores: expired deleted", await gone("semaphores", ids.semExpired));
	check("semaphores: fresh kept", await kept("semaphores", ids.semFresh));
	check("semaphores: active (NULL deleteAt) kept", await kept("semaphores", ids.semActive));
	check("tokenCaches: >5min deleted", await gone("tokenCaches", ids.tcExpired));
	check("tokenCaches: <5min kept", await kept("tokenCaches", ids.tcFresh));
	check("abortedGenerations: >1h deleted", await gone("abortedGenerations", ids.agExpired));
	check("abortedGenerations: <1h kept", await kept("abortedGenerations", ids.agFresh));

	// conversation retention + FK-ordered dependent cleanup
	const rowGone = async (table: typeof schema.conversations | typeof schema.reports, id: string) =>
		(await db.select().from(table).where(eq(table.id, id))).length === 0;
	check("conversations: >RETENTION_DAYS deleted", await rowGone(schema.conversations, convExpired));
	check("conversations: recent kept", !(await rowGone(schema.conversations, convFresh)));
	check(
		"reports: dependent of expired conv deleted (FK order held)",
		await rowGone(schema.reports, reportExpired)
	);
	check(
		"files: dependent of expired conv deleted",
		(await db.select().from(schema.files).where(eq(schema.files.id, fileExpired))).length === 0
	);

	// ── tidy: drop the fresh seeds we deliberately kept ───────────────────────────
	await collections.sessions.deleteOne({ _id: ids.sessFresh });
	await collections.messageEvents.deleteOne({ _id: ids.meFresh });
	await collections.semaphores.deleteOne({ _id: ids.semFresh });
	await collections.semaphores.deleteOne({ _id: ids.semActive });
	await collections.tokenCaches.deleteOne({ _id: ids.tcFresh });
	await collections.abortedGenerations.deleteOne({ _id: ids.agFresh });
	await db.delete(schema.conversations).where(eq(schema.conversations.id, convFresh));

	await closeDb();
	console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
