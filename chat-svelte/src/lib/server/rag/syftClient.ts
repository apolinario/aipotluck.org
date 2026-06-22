// Lazily-constructed, shared OpenMined SyftHub client. The federated stores
// (EPFL retrieval + the local-culture vault) both authenticate with the same
// API token, so we build one client and reuse it. Returns null when no token is
// configured so callers fail open to a normal answer.

import { SyftHubClient } from "@syfthub/sdk";
import { syft } from "./env";

let client: SyftHubClient | null = null;
let builtFor = "";

export function getSyftClient(): SyftHubClient | null {
	const { token, baseUrl } = syft();
	if (!token) {
		return null;
	}
	// Rebuild if the token/base changed (e.g. via the config manager at runtime).
	const key = `${baseUrl}::${token}`;
	if (!client || builtFor !== key) {
		client = new SyftHubClient({ baseUrl, apiToken: token });
		builtFor = key;
	}
	return client;
}
