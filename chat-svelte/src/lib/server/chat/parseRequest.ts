import { error } from "@sveltejs/kit";
import { z } from "zod";
import { chatRequestSchema, type ChatRequestPayload } from "$lib/server/chat/requestSchema";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "$lib/constants/fileSize";
import { MULTIMODAL_ENABLED } from "$lib/server/textOnly";
import { uploadFile } from "$lib/server/files/uploadFile";
import { usageLimits } from "$lib/server/usageLimits";
import type { Conversation } from "$lib/types/Conversation";
import type { Message } from "$lib/types/Message";

/** The typed inputs a chat turn needs, parsed out of the multipart POST body. MCP selection and
 *  timezone are not returned — they are attached to `locals` as forward-looking pipeline context
 *  (see below). */
export interface ParsedChatRequest {
	newPrompt: ChatRequestPayload["inputs"];
	messageId: ChatRequestPayload["id"];
	isRetry: ChatRequestPayload["is_retry"];
	generationId: ChatRequestPayload["generationId"];
	searchContext: ChatRequestPayload["searchContext"];
	uploadedFiles: NonNullable<Message["files"]>;
}

/**
 * Parse and validate the multipart chat POST: the JSON `data` field (via chatRequestSchema) plus
 * the attached files, returning the typed inputs the rest of the turn consumes. Side effects, in
 * the exact order the inline handler ran them so error precedence is preserved:
 *   - 400 if `data` is missing/non-string, then schema validation;
 *   - attaches the per-turn MCP selection + timezone to `locals` (forward-looking, see note below);
 *   - 415 if an attachment is present while the text-only alpha gate is closed;
 *   - 400 if the prompt exceeds the configured message-length limit;
 *   - 413 if a base64 upload exceeds the shared file-size cap;
 *   - uploads base64 files (hash refs pass through untouched).
 */
export async function parseChatRequest(opts: {
	request: Request;
	conv: Conversation;
	locals: App.Locals;
}): Promise<ParsedChatRequest> {
	const { request, conv, locals } = opts;

	const form = await request.formData();

	const json = form.get("data");

	if (!json || typeof json !== "string") {
		error(400, "Invalid request");
	}

	const {
		inputs: newPrompt,
		id: messageId,
		is_retry: isRetry,
		generationId,
		selectedMcpServerNames,
		selectedMcpServers,
		timezone,
		searchContext,
	} = chatRequestSchema.parse(JSON.parse(json));

	// Attach MCP selection to locals so the text generation pipeline can consume it.
	// FORWARD-LOOKING: nothing reads locals.mcp yet — MCP tools are gated off for the alpha.
	// The read side (thread this into maybeRunMcpTool, see $lib/server/mcp) lands when tools
	// re-enable, post-alpha alongside the Apertus 1.5 8B release. Kept wired so re-enabling is
	// a read-side change only.
	try {
		locals.mcp = {
			selectedServerNames: selectedMcpServerNames,
			selectedServers: (selectedMcpServers ?? []).map((s) => ({
				name: s.name,
				url: s.url,
				headers:
					s.headers && s.headers.length > 0
						? Object.fromEntries(s.headers.map((h) => [h.key, h.value]))
						: undefined,
			})),
		};
	} catch {
		// ignore attachment errors, pipeline will just use env servers
	}

	// Attach user timezone so the tool prompt can include localized time. Same status as
	// locals.mcp above: forward-looking, consumed when MCP tools re-enable post-alpha.
	if (timezone) {
		locals.timezone = timezone;
	}

	const inputFiles = await Promise.all(
		form
			.getAll("files")
			.filter((entry): entry is File => entry instanceof File && entry.size > 0)
			.map(async (file) => {
				const [type, ...name] = file.name.split(";");

				return {
					type: z.literal("base64").or(z.literal("hash")).parse(type),
					value: await file.text(),
					mime: file.type,
					name: name.join(";"),
				};
			})
	);

	// TEXT-ONLY ALPHA (until July 9): reject any attachment server-side. The UI hides upload, but
	// enforce it here too so a crafted request can't slip a file/image through. Gated, not removed —
	// flip MULTIMODAL_ENABLED post-July. See $lib/server/textOnly.
	if (!MULTIMODAL_ENABLED && inputFiles.length > 0) {
		error(415, "Attachments are disabled — this alpha is text-only.");
	}

	if (usageLimits?.messageLength && (newPrompt?.length ?? 0) > usageLimits.messageLength) {
		error(400, "Message too long.");
	}

	// each file is either:
	// base64 string requiring upload to the server
	// hash pointing to an existing file
	const hashFiles = inputFiles?.filter((file) => file.type === "hash") ?? [];
	const b64Files =
		inputFiles
			?.filter((file) => file.type !== "hash")
			.map((file) => {
				const blob = Buffer.from(file.value, "base64");
				return new File([blob], file.name, { type: file.mime });
			}) ?? [];

	// check sizes — cap + label come from the shared constant (see $lib/constants/fileSize)
	if (b64Files.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
		error(413, `File too large, should be <${MAX_FILE_SIZE_LABEL}`);
	}

	const uploadedFiles = await Promise.all(b64Files.map((file) => uploadFile(file, conv))).then(
		(files) => [...files, ...hashFiles]
	);

	return { newPrompt, messageId, isRetry, generationId, searchContext, uploadedFiles };
}
