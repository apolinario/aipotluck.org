import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { error } from "@sveltejs/kit";
import { ObjectId } from "bson";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { downloadFile } from "$lib/server/files/downloadFile";
import mimeTypes from "mime-types";

export const GET: RequestHandler = async ({ locals, params }) => {
	const sha256 = z.string().parse(params.sha256);

	const userId = locals.user?._id ?? locals.sessionId;

	// check user
	if (!userId) {
		error(401, "Unauthorized");
	}

	const convId = new ObjectId(z.string().parse(params.id));

	// check if the user has access to the conversation
	const conv = await collections.conversations.findOne({
		_id: convId,
		...authCondition(locals),
	});

	if (!conv) {
		error(404, "Conversation not found");
	}

	const { value, mime } = await downloadFile(sha256, convId);

	const b64Value = Buffer.from(value, "base64");
	return new Response(b64Value, {
		headers: {
			"Content-Type": mime ?? "application/octet-stream",
			"Content-Security-Policy":
				"default-src 'none'; script-src 'none'; style-src 'none'; sandbox;",
			"Content-Disposition": `attachment; filename="${sha256.slice(0, 8)}.${
				mime ? mimeTypes.extension(mime) || "bin" : "bin"
			}"`,
			"Content-Length": b64Value.length.toString(),
			"Accept-Range": "bytes",
		},
	});
};
