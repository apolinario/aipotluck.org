/**
 * File store — the Postgres `files` table replacing GridFS (B1-lite migration). Attachments are small
 * (≤10 MB, enforced upstream) so a bytea payload row is sufficient and keeps everything on Neon with no
 * extra credentials. (Vercel Blob is a viable later optimization for larger payloads.) Written fresh.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { newId } from "./ids";
import { files, type FileRow } from "./schema";

export async function putFile(input: {
	filename: string;
	conversationId: string;
	mime?: string;
	data: Buffer;
}): Promise<void> {
	const db = getDb();
	await db
		.insert(files)
		.values({
			id: newId(),
			filename: input.filename,
			conversationId: input.conversationId,
			mime: input.mime,
			data: input.data,
		})
		.onConflictDoNothing();
}

export async function getFileByFilename(
	filename: string,
	conversationId: string
): Promise<FileRow | undefined> {
	const db = getDb();
	const [row] = await db
		.select()
		.from(files)
		.where(and(eq(files.filename, filename), eq(files.conversationId, conversationId)))
		.limit(1);
	return row;
}
