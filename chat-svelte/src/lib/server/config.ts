import { env as publicEnv } from "$env/dynamic/public";
import { env as serverEnv } from "$env/dynamic/private";
import { building } from "$app/environment";
import type { Collections } from "./database";
import { Semaphores } from "$lib/types/Semaphore";

export type PublicConfigKey = keyof typeof publicEnv;
const keysFromEnv = { ...publicEnv, ...serverEnv };
export type ConfigKey = keyof typeof keysFromEnv;

class ConfigManager {
	private keysFromDB: Partial<Record<ConfigKey, string>> = {};
	private isInitialized = false;

	private configCollection: Collections["config"] | undefined;
	private semaphoreCollection: Collections["semaphores"] | undefined;
	private lastConfigUpdate: Date | undefined;

	async init() {
		if (this.isInitialized) return;

		if (building || import.meta.env.MODE === "test") {
			this.isInitialized = true;
			return;
		}

		// When the DB-backed config manager is off (the default), do not touch the database at all —
		// keeps import-time and per-request paths free of DB I/O (serverless posture).
		if (!this.ConfigManagerEnabled) {
			this.isInitialized = true;
			return;
		}

		const { getCollectionsEarly } = await import("./database");
		const collections = await getCollectionsEarly();

		this.configCollection = collections.config;
		this.semaphoreCollection = collections.semaphores;

		await this.checkForUpdates().then(() => {
			this.isInitialized = true;
		});
	}

	get ConfigManagerEnabled() {
		return serverEnv.ENABLE_CONFIG_MANAGER === "true" && import.meta.env.MODE !== "test";
	}

	get isHuggingChat() {
		return this.get("PUBLIC_APP_ASSETS") === "huggingchat";
	}

	async checkForUpdates() {
		if (!this.ConfigManagerEnabled) return;
		if (await this.isConfigStale()) {
			await this.updateConfig();
		}
	}

	async isConfigStale(): Promise<boolean> {
		if (!this.lastConfigUpdate || !this.isInitialized) {
			return true;
		}
		const count = await this.semaphoreCollection?.countDocuments({
			key: Semaphores.CONFIG_UPDATE,
			updatedAt: { $gt: this.lastConfigUpdate },
		});
		return count !== undefined && count > 0;
	}

	async updateConfig() {
		const configs = (await this.configCollection?.find({}).toArray()) ?? [];
		this.keysFromDB = configs.reduce(
			(acc, curr) => {
				acc[curr.key as ConfigKey] = curr.value;
				return acc;
			},
			{} as Record<ConfigKey, string>
		);

		this.lastConfigUpdate = new Date();
	}

	get(key: ConfigKey): string {
		if (!this.ConfigManagerEnabled) {
			return keysFromEnv[key] || "";
		}
		return this.keysFromDB[key] || keysFromEnv[key] || "";
	}

	async updateSemaphore() {
		await this.semaphoreCollection?.updateOne(
			{ key: Semaphores.CONFIG_UPDATE },
			{
				$set: {
					updatedAt: new Date(),
				},
				$setOnInsert: {
					createdAt: new Date(),
				},
			},
			{ upsert: true }
		);
	}

	async set(key: ConfigKey, value: string) {
		if (!this.ConfigManagerEnabled) throw new Error("Config manager is disabled");
		await this.configCollection?.updateOne({ key }, { $set: { value } }, { upsert: true });
		this.keysFromDB[key] = value;
		await this.updateSemaphore();
	}

	async delete(key: ConfigKey) {
		if (!this.ConfigManagerEnabled) throw new Error("Config manager is disabled");
		await this.configCollection?.deleteOne({ key });
		delete this.keysFromDB[key];
		await this.updateSemaphore();
	}

	async clear() {
		if (!this.ConfigManagerEnabled) throw new Error("Config manager is disabled");
		await this.configCollection?.deleteMany({});
		this.keysFromDB = {};
		await this.updateSemaphore();
	}

	getPublicConfig() {
		let config = {
			...Object.fromEntries(
				Object.entries(keysFromEnv).filter(([key]) => key.startsWith("PUBLIC_"))
			),
		} as Record<PublicConfigKey, string>;

		if (this.ConfigManagerEnabled) {
			config = {
				...config,
				...Object.fromEntries(
					Object.entries(this.keysFromDB).filter(([key]) => key.startsWith("PUBLIC_"))
				),
			};
		}

		const publicEnvKeys = Object.keys(publicEnv);

		return Object.fromEntries(
			Object.entries(config).filter(([key]) => publicEnvKeys.includes(key))
		) as Record<PublicConfigKey, string>;
	}
}

// Create the instance and initialize it.
const configManager = new ConfigManager();

export const ready = (async () => {
	if (!building) {
		await configManager.init();
	}
})();

type ExtraConfigKeys =
	| "HF_TOKEN"
	| "OLD_MODELS"
	| "ENABLE_ASSISTANTS"
	| "METRICS_ENABLED"
	| "METRICS_PORT"
	// Service-wide daily request cap (cost/abuse guardrail) — enforced in conversation/[id]/+server.
	| "GLOBAL_DAILY_REQUEST_CAP"
	// Marginalia open-web search auth (api2 endpoint). Unset → shared "public" demo key.
	// MARGINALIA_FILTER names a server-side custom filter (e.g. temporal-bias RECENT) applied to
	// open-web searches when set. NOTE: a personal key is DEV-ONLY (1000 queries/day hard cap);
	// production must use Public AI's own metered commercial key.
	| "MARGINALIA_API_KEY"
	| "MARGINALIA_FILTER";
// Removed 2026-06-19 (config audit — nothing read them): EXA_API_KEY (Exa search rejected in favor of
// all-open Wikipedia/Marginalia/OpenAlex), and MCP_SERVERS / MCP_FORWARD_HF_USER_TOKEN / MCP_TOOL_TIMEOUT_MS
// (upstream chat-ui MCP config; our MCP restoration uses SPACE_MCP_URL via Reflect.get instead).

type ConfigProxy = ConfigManager & { [K in ConfigKey | ExtraConfigKeys]: string };

export const config: ConfigProxy = new Proxy(configManager, {
	get(target, prop, receiver) {
		if (prop in target) {
			return Reflect.get(target, prop, receiver);
		}
		if (typeof prop === "string") {
			return target.get(prop as ConfigKey);
		}
		return undefined;
	},
	set(target, prop, value, receiver) {
		if (prop in target) {
			return Reflect.set(target, prop, value, receiver);
		}
		if (typeof prop === "string") {
			target.set(prop as ConfigKey, value);
			return true;
		}
		return false;
	},
}) as ConfigProxy;
