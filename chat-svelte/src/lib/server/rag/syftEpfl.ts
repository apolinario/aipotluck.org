// Federated store #1 — EPFL News publisher endpoint on OpenMined SyftHub.
// Mirrors the notebook's `client.syftai.query_data_source(...)`: semantic
// retrieval over a paid data source that returns structured news documents. We
// settle the MPP payment challenge (pay: true) using the configured testnet
// wallet, the same as the demo.
//
// FAIL-OPEN: no token, no endpoint, no user email, or any SDK error returns []
// so the chat answers without EPFL grounding.

import type { RagSource } from "$lib/types/Rag";
import { getSyftClient } from "./syftClient";
import { syft } from "./env";
import { logger } from "$lib/server/logger";

/** Best-effort title/url/snippet from a retrieved document's content. EPFL docs
 *  arrive as JSON (a single article or an array of them); fall back to raw text.
 *  Exported for unit testing against the notebook's response shape. */
export function parseEpflDocContent(
	content: string
): Array<{ title: string; url?: string; snippet: string }> {
	const raw = (content ?? "").trim();
	if (!raw) {
		return [];
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [{ title: "EPFL News", snippet: raw }];
	}
	const items = Array.isArray(parsed) ? parsed : [parsed];
	return items.flatMap((item) => {
		if (!item || typeof item !== "object") {
			return [];
		}
		const o = item as Record<string, unknown>;
		const title = typeof o.title === "string" && o.title ? o.title : "EPFL News";
		const url = typeof o.url === "string" ? o.url : undefined;
		const snippet = [o.subtitle, o.text_snippet, o.content]
			.map((v) => (typeof v === "string" ? v : ""))
			.find((v) => v.trim())
			?.replace(/<[^>]+>/g, " ") // strip the HTML the news API embeds
			.replace(/\s+/g, " ")
			.trim();
		return [{ title, url, snippet: snippet || title }];
	});
}

/** Retrieve EPFL News documents for a query as citable sources (no numbers yet). */
export async function queryEpfl(query: string, userEmail: string): Promise<Omit<RagSource, "n">[]> {
	const client = getSyftClient();
	const { epfl, userEmail: fallbackEmail } = syft();
	const email = (userEmail || fallbackEmail).trim();
	if (!client || !epfl.url || !epfl.slug || !email) {
		return [];
	}
	try {
		const docs = await client.syftai.queryDataSource({
			endpoint: { url: epfl.url, slug: epfl.slug, ownerUsername: epfl.owner || undefined },
			query,
			userEmail: email,
			topK: 5,
			similarityThreshold: 0.5,
			pay: true,
		});
		return docs.flatMap((doc) =>
			parseEpflDocContent(doc.content).map((s) => ({
				...s,
				engine: "SyftHub:EPFL" as const,
				score: typeof doc.score === "number" ? doc.score : undefined,
			}))
		);
	} catch (e) {
		logger.warn(e, "[rag] EPFL query failed; answering without EPFL grounding");
		return [];
	}
}
