// Shouldn't be needed if we dove into sveltekit internals, see https://github.com/huggingface/chat-ui/pull/88#issuecomment-1523173850

import { logger } from "$lib/server/logger";
import { collections } from "$lib/server/database";
import { onExit } from "./exitHandler";

export class AbortedGenerations {
	private static instance: AbortedGenerations;

	private abortedGenerations: Record<string, Date> = {};

	private constructor() {
		// Serverless-friendly: do NOT query eagerly here. getInstance() runs at server init, so an
		// eager query races a cold Neon pooler connection and tripped CONNECT_TIMEOUT on the first
		// request of a fresh function. Let the first poll fire after the interval (DB is connected
		// by then); until then getAbortTime() returns undefined — "not aborted", the safe default.
		// 1s poll keeps abort latency responsive without hammering the max:1 pool twice a second.
		const interval = setInterval(() => this.updateList(), 1000);
		onExit(() => clearInterval(interval));
	}

	public static getInstance(): AbortedGenerations {
		if (!AbortedGenerations.instance) {
			AbortedGenerations.instance = new AbortedGenerations();
		}

		return AbortedGenerations.instance;
	}

	public getAbortTime(conversationId: string): Date | undefined {
		return this.abortedGenerations[conversationId];
	}

	private async updateList() {
		try {
			const aborts = await collections.abortedGenerations.find({}).sort({ createdAt: 1 }).toArray();

			this.abortedGenerations = Object.fromEntries(
				aborts.map((abort) => [abort.conversationId.toString(), abort.updatedAt ?? abort.createdAt])
			);
		} catch (err) {
			logger.error(err, "Error updating aborted generations list");
		}
	}
}
