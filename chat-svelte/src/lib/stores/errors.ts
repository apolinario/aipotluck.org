import { writable } from "svelte/store";

export const ERROR_MESSAGES = {
	default: "Oops, something went wrong.",
	authOnly: "You have to be logged in.",
	rateLimited: "You are sending too many messages. Try again later.",
	connectionLost: "The connection dropped before a reply arrived. Please try again.",
};

export const error = writable<string | undefined>(undefined);

/** Is this error string one of the server's rate-limit / cap 429 messages (per-session, global daily,
 *  or per-conversation)? Used to give those a longer-lived toast and to preserve the unsent text, so a
 *  hard stop is never a 5-second flash that silently eats the message. */
export const isRateLimitMessage = (message: string | undefined): boolean =>
	/too many messages|request limit|more than \d+ messages/i.test(message ?? "");
