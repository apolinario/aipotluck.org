// Federated store #2 — the local-culture data vault on OpenMined SyftHub.
// Mirrors the notebook's `client.chat.complete(model="irina11/test-user-data")`:
// instead of returning raw documents, a local agent synthesizes and filters the
// private/personal canton data and returns a single answer, so the underlying
// documents never leave the vault. We therefore ground on the synthesized text
// (attributed as federated/local knowledge) rather than as a citable source.
//
// FAIL-OPEN: no token, no model, or any SDK error returns null so the chat
// answers without vault grounding.

import { getSyftClient } from "./syftClient";
import { syft } from "./env";
import { logger } from "$lib/server/logger";

/** Ask the vault's federated agent to synthesize an answer; null if unavailable. */
export async function queryVault(query: string): Promise<string | null> {
	const client = getSyftClient();
	const { vaultModel } = syft();
	if (!client || !vaultModel) {
		return null;
	}
	try {
		const res = await client.chat.complete({ prompt: query, model: vaultModel });
		const answer = res.response?.trim();
		return answer || null;
	} catch (e) {
		logger.warn(e, "[rag] vault query failed; answering without vault grounding");
		return null;
	}
}
