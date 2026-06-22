import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Conversation } from "$lib/types/Conversation";

// Holders shared with the mock factories (hoisted above imports). MULTIMODAL_ENABLED and the
// file-size cap are named-import bindings, so they're mocked via getters to stay flippable per test.
const { uploadFile, usageLimitsMock, multimodal, fileSize } = vi.hoisted(() => ({
	uploadFile: vi.fn(),
	usageLimitsMock: { messageLength: undefined, messages: undefined } as {
		messageLength?: number;
		messages?: number;
	},
	multimodal: { enabled: false },
	fileSize: { bytes: 10_000_000, label: "10MB" },
}));

vi.mock("$lib/server/files/uploadFile", () => ({ uploadFile }));
vi.mock("$lib/server/usageLimits", () => ({ usageLimits: usageLimitsMock }));
vi.mock("$lib/server/textOnly", () => ({
	get MULTIMODAL_ENABLED() {
		return multimodal.enabled;
	},
}));
vi.mock("$lib/constants/fileSize", () => ({
	get MAX_FILE_SIZE_BYTES() {
		return fileSize.bytes;
	},
	get MAX_FILE_SIZE_LABEL() {
		return fileSize.label;
	},
}));

import { parseChatRequest } from "./parseRequest";

const conv = { _id: "c1" } as unknown as Conversation;
const GEN_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(data: unknown, files: File[] = []): Request {
	const fd = new FormData();
	fd.set("data", JSON.stringify(data));
	for (const f of files) fd.append("files", f);
	return { formData: async () => fd } as unknown as Request;
}

function makeLocals(): App.Locals {
	return { sessionId: "s1", isAdmin: false } as unknown as App.Locals;
}

beforeEach(() => {
	uploadFile.mockReset().mockResolvedValue({ type: "hash", value: "uploaded-hash" });
	usageLimitsMock.messageLength = undefined;
	usageLimitsMock.messages = undefined;
	multimodal.enabled = false;
	fileSize.bytes = 10_000_000;
	fileSize.label = "10MB";
});

describe("parseChatRequest", () => {
	it("parses the data field into the turn's typed inputs", async () => {
		const req = makeRequest({ inputs: "hello", is_retry: false, generationId: GEN_ID });
		const out = await parseChatRequest({ request: req, conv, locals: makeLocals() });
		expect(out).toMatchObject({
			newPrompt: "hello",
			isRetry: false,
			generationId: GEN_ID,
			uploadedFiles: [],
		});
	});

	it("throws 400 when the data field is missing", async () => {
		const fd = new FormData();
		const req = { formData: async () => fd } as unknown as Request;
		await expect(parseChatRequest({ request: req, conv, locals: makeLocals() })).rejects.toMatchObject(
			{ status: 400 }
		);
	});

	it("attaches the per-turn MCP selection and timezone to locals", async () => {
		const locals = makeLocals();
		const req = makeRequest({
			inputs: "hi",
			timezone: "Europe/Zurich",
			selectedMcpServerNames: ["fs"],
			selectedMcpServers: [
				{ name: "fs", url: "http://x", headers: [{ key: "Authorization", value: "Bearer t" }] },
			],
		});
		await parseChatRequest({ request: req, conv, locals });
		expect(locals.timezone).toBe("Europe/Zurich");
		expect(locals.mcp).toEqual({
			selectedServerNames: ["fs"],
			selectedServers: [{ name: "fs", url: "http://x", headers: { Authorization: "Bearer t" } }],
		});
	});

	it("throws 415 when an attachment is present while the text-only gate is closed", async () => {
		multimodal.enabled = false;
		const file = new File(["aGVsbG8="], "base64;a.txt", { type: "text/plain" });
		const req = makeRequest({ inputs: "hi" }, [file]);
		await expect(parseChatRequest({ request: req, conv, locals: makeLocals() })).rejects.toMatchObject(
			{ status: 415 }
		);
	});

	it("throws 400 when the prompt exceeds the configured message-length limit", async () => {
		usageLimitsMock.messageLength = 3;
		const req = makeRequest({ inputs: "way too long" });
		await expect(parseChatRequest({ request: req, conv, locals: makeLocals() })).rejects.toMatchObject(
			{ status: 400 }
		);
	});

	it("throws 413 when a base64 upload exceeds the file-size cap", async () => {
		multimodal.enabled = true; // get past the text-only gate to reach the size check
		fileSize.bytes = 4; // tiny cap so a small payload trips it
		// "aGVsbG8=" decodes to "hello" (5 bytes) > 4
		const file = new File(["aGVsbG8="], "base64;a.txt", { type: "text/plain" });
		const req = makeRequest({ inputs: "hi" }, [file]);
		await expect(parseChatRequest({ request: req, conv, locals: makeLocals() })).rejects.toMatchObject(
			{ status: 413 }
		);
	});

	it("uploads base64 files and passes hash references through untouched", async () => {
		multimodal.enabled = true;
		const b64 = new File(["aGVsbG8="], "base64;a.txt", { type: "text/plain" });
		const hash = new File(["deadbeef"], "hash;b.txt", { type: "text/plain" });
		const req = makeRequest({ inputs: "hi" }, [b64, hash]);
		const out = await parseChatRequest({ request: req, conv, locals: makeLocals() });
		expect(uploadFile).toHaveBeenCalledTimes(1); // only the base64 file is uploaded
		expect(out.uploadedFiles).toEqual([
			{ type: "hash", value: "uploaded-hash" }, // the uploaded result
			{ type: "hash", value: "deadbeef", mime: "text/plain", name: "b.txt" }, // pass-through
		]);
	});
});
