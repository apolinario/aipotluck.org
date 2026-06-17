import { config } from "$lib/server/config";
import { collections } from "$lib/server/database";
import type { Message } from "$lib/types/Message";
import { error } from "@sveltejs/kit";
import { pathToFileURL } from "node:url";
import { unlink } from "node:fs/promises";
import { uploadFile } from "@huggingface/hub";
import parquet from "parquetjs";
import { z } from "zod";
import { logger } from "$lib/server/logger.js";

// Triger like this:
// curl -X POST "http://localhost:5173/chat/admin/export" -H "Authorization: Bearer <ADMIN_API_SECRET>" -H "Content-Type: application/json" -d '{"model": "OpenAssistant/oasst-sft-6-llama-30b-xor"}'

export async function POST({ request }) {
	if (!config.PARQUET_EXPORT_DATASET || !config.PARQUET_EXPORT_HF_TOKEN) {
		error(500, "Parquet export is not configured.");
	}

	const { model } = z
		.object({
			model: z.string(),
		})
		.parse(await request.json());

	const schema = new parquet.ParquetSchema({
		title: { type: "UTF8" },
		created_at: { type: "TIMESTAMP_MILLIS" },
		updated_at: { type: "TIMESTAMP_MILLIS" },
		messages: {
			repeated: true,
			fields: {
				from: { type: "UTF8" },
				content: { type: "UTF8" },
				score: { type: "INT_8", optional: true },
			},
		},
	});

	const fileName = `/tmp/conversations-${new Date().toJSON().slice(0, 10)}-${Date.now()}.parquet`;

	const writer = await parquet.ParquetWriter.openFile(schema, fileName);

	let count = 0;
	logger.info("Exporting conversations for model", model);

	const appendConversation = async (conv: {
		title: string;
		createdAt: Date;
		updatedAt: Date;
		messages: Message[];
	}) => {
		await writer.appendRow({
			title: conv.title,
			created_at: conv.createdAt,
			updated_at: conv.updatedAt,
			messages: conv.messages.map((message: Message) => ({
				from: message.from,
				content: message.content,
				...(message.score ? { score: message.score } : undefined),
			})),
		});
		++count;
		if (count % 1_000 === 0) {
			logger.info("Exported", count, "conversations");
		}
	};

	// Anonymous (session-scoped) shared conversations. The Mongo $lookup join is expressed here as an
	// explicit settings → conversations fetch (the adapter has no aggregation pipeline by design).
	const sharedSessionSettings = await collections.settings
		.find({
			shareConversationsWithModelAuthors: true,
			sessionId: { $exists: true },
			userId: { $exists: false },
		})
		.toArray();
	for (const s of sharedSessionSettings) {
		if (!s.sessionId) continue;
		const convs = await collections.conversations
			.find({ sessionId: s.sessionId, model, userId: { $exists: false } })
			.toArray();
		for (const conv of convs) await appendConversation(conv);
	}

	logger.info("exporting convos with userId");

	// User-scoped shared conversations.
	const sharedUserSettings = await collections.settings
		.find({ shareConversationsWithModelAuthors: true, userId: { $exists: true } })
		.toArray();
	for (const s of sharedUserSettings) {
		if (!s.userId) continue;
		const convs = await collections.conversations.find({ userId: s.userId, model }).toArray();
		for (const conv of convs) await appendConversation(conv);
	}

	await writer.close();

	logger.info("Uploading", fileName, "to Hugging Face Hub");

	await uploadFile({
		file: pathToFileURL(fileName) as URL,
		credentials: { accessToken: config.PARQUET_EXPORT_HF_TOKEN },
		repo: {
			type: "dataset",
			name: config.PARQUET_EXPORT_DATASET,
		},
	});

	logger.info("Upload done");

	await unlink(fileName);

	return new Response();
}
