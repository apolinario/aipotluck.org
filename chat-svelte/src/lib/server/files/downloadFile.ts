import { error } from "@sveltejs/kit";
import type { Conversation } from "$lib/types/Conversation";
import type { MessageFile } from "$lib/types/Message";
import { getFileByFilename } from "$lib/server/db/files";

export async function downloadFile(
	sha256: string,
	convId: Conversation["_id"]
): Promise<MessageFile & { type: "base64" }> {
	const filename = `${convId.toString()}-${sha256}`;
	const file = await getFileByFilename(filename, convId.toString());

	if (!file) {
		error(404, "File not found");
	}
	if (file.conversationId !== convId.toString()) {
		error(403, "You don't have access to this file.");
	}

	return {
		type: "base64",
		name: file.filename,
		value: Buffer.from(file.data).toString("base64"),
		mime: file.mime ?? "application/octet-stream",
	};
}
