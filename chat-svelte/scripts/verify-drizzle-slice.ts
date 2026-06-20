/**
 * Verification harness for the B1-lite persistence seam — exercises the Mongo-shaped adapter
 * (db/mongoAdapter.ts) over the document-store tables exactly as the runtime call sites do, against a
 * throwaway Postgres (Docker). No cloud, no HF calls.
 *
 *   DATABASE_URL=postgres://... npx -y tsx scripts/verify-drizzle-slice.ts
 *
 * Proves: ObjectId/Date round-trip through JSONB (incl. nested), authCondition filters, upsert with
 * $set/$setOnInsert, $unset, ownership-scoped delete, the semaphore unique-key lock primitive, cursor
 * sort/limit, and the config key/value table.
 */
import { ObjectId } from "bson";
import { collections } from "../src/lib/server/database.ts";
import { closeDb } from "../src/lib/server/db/client.ts";

let failures = 0;
function check(name: string, cond: boolean) {
	console.log(`${cond ? "  ok " : "FAIL "} ${name}`);
	if (!cond) failures++;
}

async function main() {
	const sessionId = "sess-" + new ObjectId().toHexString();

	// 1. insertOne with explicit _id + nested message tree (as conversation/+server.ts does)
	const convId = new ObjectId();
	const userMsgId = crypto.randomUUID();
	const asstMsgId = crypto.randomUUID();
	const ins = await collections.conversations.insertOne({
		_id: convId,
		title: "New Chat",
		model: "apertus",
		sessionId,
		rootMessageId: userMsgId,
		createdAt: new Date(),
		updatedAt: new Date(),
		messages: [
			{ from: "user", id: userMsgId, content: "hi", ancestors: [], children: [asstMsgId] },
			{ from: "assistant", id: asstMsgId, content: "hello", ancestors: [userMsgId], children: [] },
		],
	});
	check("insertOne returns ObjectId insertedId", ins.insertedId instanceof ObjectId);
	check("insertedId equals provided _id", ins.insertedId.toString() === convId.toString());

	// 2. findOne by _id (ObjectId filter) + authCondition (sessionId)
	const loaded = await collections.conversations.findOne({
		_id: convId,
		sessionId,
		userId: { $exists: false },
	});
	check("findOne by _id + anon authCondition", !!loaded);
	check("_id revived as ObjectId", loaded?._id instanceof ObjectId);
	check("message tree round-trips", loaded?.messages?.length === 2);
	check(
		"tree edges round-trip",
		loaded?.messages?.[1].ancestors?.[0] === userMsgId &&
			loaded?.messages?.[0].children?.[0] === asstMsgId
	);
	check("createdAt revived as Date", loaded?.createdAt instanceof Date);

	// 3. whole-document updateOne($set) — the chat save pattern
	await collections.conversations.updateOne(
		{ _id: convId },
		{ $set: { title: "Open models 101", updatedAt: new Date() } }
	);
	check(
		"updateOne $set persists",
		(await collections.conversations.findOne({ _id: convId }))?.title === "Open models 101"
	);

	// 4. count + cursor sort/limit
	await collections.conversations.insertOne({
		_id: new ObjectId(),
		title: "second",
		model: "apertus",
		sessionId,
		createdAt: new Date(),
		updatedAt: new Date(Date.now() + 1000),
	});
	check(
		"countDocuments by session",
		(await collections.conversations.countDocuments({ sessionId })) === 2
	);
	const sorted = await collections.conversations
		.find({ sessionId })
		.sort({ updatedAt: -1 })
		.limit(1)
		.toArray();
	check("cursor sort desc + limit", sorted.length === 1 && sorted[0].title === "second");

	// 5. ownership-scoped deleteOne
	const del = await collections.conversations.deleteOne({ _id: convId, sessionId });
	check("deleteOne removes one", del.deletedCount === 1);
	check(
		"delete respects filter (other survives)",
		(await collections.conversations.countDocuments({ sessionId })) === 1
	);

	// 6. settings upsert with $set + $setOnInsert (authCondition anon)
	await collections.settings.updateOne(
		{ sessionId, userId: { $exists: false } },
		{
			$set: { activeModel: "apertus", multimodalOverrides: { x: true } },
			$setOnInsert: { createdAt: new Date() },
		},
		{ upsert: true }
	);
	const st = await collections.settings.findOne({ sessionId, userId: { $exists: false } });
	check("settings upsert seeds sessionId from filter", st?.sessionId === sessionId);
	check(
		"settings wide field round-trips (JSONB doc)",
		(st?.multimodalOverrides as { x?: boolean })?.x === true
	);
	check("settings $setOnInsert applied", st?.createdAt instanceof Date);
	await collections.settings.updateOne(
		{ sessionId, userId: { $exists: false } },
		{ $set: { activeModel: "apertus-2" } },
		{ upsert: true }
	);
	check(
		"settings upsert updates in place",
		(await collections.settings.findOne({ sessionId }))?.activeModel === "apertus-2"
	);

	// 7. users upsert-by-update + $unset (the login migrate-settings path)
	const uId = new ObjectId();
	await collections.users.insertOne({
		_id: uId,
		hfUserId: "hf-" + uId.toHexString(),
		name: "Ada",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	await collections.users.updateOne({ _id: uId }, { $set: { name: "Ada Lovelace" } });
	check(
		"users updateOne by _id",
		(await collections.users.findOne({ hfUserId: "hf-" + uId.toHexString() }))?.name ===
			"Ada Lovelace"
	);
	await collections.settings.updateOne(
		{ sessionId },
		{ $set: { userId: uId, updatedAt: new Date() }, $unset: { sessionId: "" } }
	);
	const moved = await collections.settings.findOne({ userId: uId });
	check("$unset removes sessionId", moved?.sessionId === undefined);
	check("settings moved to user (userId ObjectId revived)", moved?.userId instanceof ObjectId);

	// 8. sessions — nested Date in oauth round-trips; expiry filter
	const sid = "tok-" + new ObjectId().toHexString();
	await collections.sessions.insertOne({
		_id: new ObjectId(),
		sessionId: sid,
		userId: uId,
		expiresAt: new Date(Date.now() + 60_000),
		oauth: { token: { value: "abc", expiresAt: new Date(Date.now() + 3600_000) } },
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	const sess = await collections.sessions.findOne({ sessionId: sid });
	check("session found by sessionId", !!sess);
	check(
		"nested oauth.token.expiresAt revived as Date",
		(sess?.oauth as { token?: { expiresAt?: unknown } })?.token?.expiresAt instanceof Date
	);

	// 9. semaphores — unique-key lock: second insert with same key must THROW (lock held)
	const lockKey = "lock-" + new ObjectId().toHexString();
	await collections.semaphores.insertOne({
		_id: new ObjectId(),
		key: lockKey,
		createdAt: new Date(),
	});
	let threw = false;
	try {
		await collections.semaphores.insertOne({
			_id: new ObjectId(),
			key: lockKey,
			createdAt: new Date(),
		});
	} catch {
		threw = true;
	}
	check("semaphore duplicate-key insert throws (lock primitive)", threw);
	check(
		"isDBLocked-style count",
		(await collections.semaphores.countDocuments({ key: lockKey })) === 1
	);

	// 10. abortedGenerations upsert by conversationId
	const aConv = new ObjectId();
	await collections.abortedGenerations.updateOne(
		{ conversationId: aConv },
		{ $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
		{ upsert: true }
	);
	const marker = await collections.abortedGenerations.findOne({ conversationId: aConv });
	check(
		"abortedGenerations upsert + conversationId ObjectId revived",
		marker?.conversationId instanceof ObjectId
	);

	// 11. config key/value table (identity = key, no _id emitted)
	await collections.config.updateOne(
		{ key: "flags" },
		{ $set: { value: { web_search: true } } },
		{ upsert: true }
	);
	const cfgs = await collections.config.find({}).toArray();
	const flag = cfgs.find((c) => (c as { key?: string }).key === "flags");
	check(
		"config find({}) returns key/value",
		(flag?.value as { web_search?: boolean })?.web_search === true
	);
	check("config emits no _id", flag?._id === undefined);

	await closeDb();
	console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
