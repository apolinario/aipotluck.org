import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

// Open-knowledge search context (Wikipedia + Marginalia), attached only when the
// user accepts the "search open sources?" affordance. The client fetches it from
// /api/search, then sends it with the turn so the model is grounded on numbered
// sources and the answer can cite [n]. Mirrors lib/search/open-search.ts.
const searchSourceSchema = z.object({
  n: z.number().int().min(1),
  title: z.string().max(300),
  url: z.string().url(),
  snippet: z.string().max(600),
  engine: z.enum(["Wikipedia", "Marginalia"]),
  asOf: z.string().optional(),
});

const searchContextSchema = z.object({
  query: z.string().max(400),
  sources: z.array(searchSourceSchema).max(12),
  evidence: z.string().max(8000),
  asOf: z.string(),
});

export type SearchContext = z.infer<typeof searchContextSchema>;

const userMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user"]),
  parts: z.array(partSchema),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.record(z.unknown())),
});

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
  searchContext: searchContextSchema.optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
