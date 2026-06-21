/// <reference types="@sveltejs/kit" />
/// <reference types="unplugin-icons/types/svelte" />

import type { User } from "$lib/types/User";

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}

		/** Per-turn MCP server selection the client attaches to a chat POST, normalized
		 *  for the text-generation pipeline. Forward-looking plumbing: MCP tools are gated
		 *  off in the alpha, so nothing consumes this yet (see $lib/server/mcp). */
		interface RequestMcpSelection {
			selectedServerNames?: string[];
			selectedServers: Array<{
				name: string;
				url: string;
				headers?: Record<string, string>;
			}>;
		}

		interface Locals {
			sessionId: string;
			user?: User;
			isAdmin: boolean;
			token?: string;
			/** Organization to bill inference requests to (from settings) */
			billingOrganization?: string;
			/** MCP selection forwarded by the client for this turn (see RequestMcpSelection). */
			mcp?: RequestMcpSelection;
			/** User's IANA timezone for this turn, so the tool prompt can localize the time. */
			timezone?: string;
		}

		interface Error {
			message: string;
			errorId?: ReturnType<typeof crypto.randomUUID>;
		}
		// interface PageData {}
		// interface Platform {}
		interface PageState {
			/** First message text carried from the home/model page to a new conversation. */
			pendingMessage?: string;
			/** Nonce for looking up File[] in the client-side pendingFiles Map. */
			pendingFilesNonce?: string;
			/** Open-web search grounding carried from the home page to a new
			 *  conversation, so a web-search-toggled first message stays grounded. */
			pendingSearchContext?: import("$lib/types/Search").SearchContext;
		}
	}
}

export {};
