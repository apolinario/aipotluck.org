import { writable } from "svelte/store";

export const ERROR_MESSAGES = {
	default: "Oops, something went wrong.",
	authOnly: "You have to be logged in.",
	rateLimited: "You are sending too many messages. Try again later.",
	connectionLost: "The connection dropped before a reply arrived. Please try again.",
};

export const error = writable<string | undefined>(undefined);
