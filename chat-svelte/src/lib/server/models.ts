import { building } from "$app/environment";
import { config } from "$lib/server/config";
import { MULTIMODAL_ENABLED } from "$lib/server/textOnly";
import type { ChatTemplateInput } from "$lib/types/Template";
import { z } from "zod";
import endpoints, { endpointSchema, type Endpoint } from "./endpoints/endpoints";

import JSON5 from "json5";
import { logger } from "$lib/server/logger";
import { makeRouterEndpoint } from "$lib/server/router/endpoint";
import { sanitizeJSONEnv } from "$lib/server/envParse";

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

const modelConfig = z.object({
	/** Used as an identifier in DB */
	id: z.string().optional(),
	/** Used to link to the model page, and for inference */
	name: z.string().default(""),
	displayName: z.string().min(1).optional(),
	description: z.string().min(1).optional(),
	logoUrl: z.string().url().optional(),
	websiteUrl: z.string().url().optional(),
	modelUrl: z.string().url().optional(),
	tokenizer: z.never().optional(),
	datasetName: z.string().min(1).optional(),
	datasetUrl: z.string().url().optional(),
	preprompt: z.string().default(""),
	prepromptUrl: z.string().url().optional(),
	chatPromptTemplate: z.never().optional(),
	promptExamples: z
		.array(
			z.object({
				title: z.string().min(1),
				prompt: z.string().min(1),
			})
		)
		.optional(),
	endpoints: z.array(endpointSchema).optional(),
	providers: z.array(z.object({ supports_tools: z.boolean().optional() }).passthrough()).optional(),
	parameters: z
		.object({
			temperature: z.number().min(0).max(2).optional(),
			truncate: z.number().int().positive().optional(),
			max_tokens: z.number().int().positive().optional(),
			stop: z.array(z.string()).optional(),
			top_p: z.number().positive().optional(),
			top_k: z.number().positive().optional(),
			frequency_penalty: z.number().min(-2).max(2).optional(),
			presence_penalty: z.number().min(-2).max(2).optional(),
		})
		.passthrough()
		.optional(),
	multimodal: z.boolean().default(false),
	multimodalAcceptedMimetypes: z.array(z.string()).optional(),
	// Aggregated tool-calling capability across providers (HF router)
	supportsTools: z.boolean().default(false),
	// Reasoning-capable model (accepts `reasoning_effort` parameter)
	supportsReasoning: z.boolean().default(false),
	// Opt-in artifacts: when true, the model is instructed to emit <artifact>
	// blocks rendered in the side panel. Set per model via MODELS overrides.
	supportsArtifacts: z.boolean().default(false),
	unlisted: z.boolean().default(false),
	embeddingModel: z.never().optional(),
	/** Used to enable/disable system prompt usage */
	systemRoleSupported: z.boolean().default(true),
});

type ModelConfig = z.infer<typeof modelConfig>;

const overrideEntrySchema = modelConfig
	.partial()
	.extend({
		id: z.string().optional(),
		name: z.string().optional(),
	})
	.refine((value) => Boolean((value.id ?? value.name)?.trim()), {
		message: "Model override entry must provide an id or name",
	});

type ModelOverride = z.infer<typeof overrideEntrySchema>;

const openaiBaseUrl = config.OPENAI_BASE_URL
	? config.OPENAI_BASE_URL.replace(/\/$/, "")
	: undefined;
const isHFRouter = openaiBaseUrl === "https://router.huggingface.co/v1";

const listSchema = z
	.object({
		data: z.array(
			z.object({
				id: z.string(),
				description: z.string().optional(),
				// .nullish() not .optional(): the HF router omits these keys, but the
				// CSCS direct endpoint (api.swissai.svc.cscs.ch) returns them as
				// explicit null. .optional() rejects null and would throw on parse,
				// loading zero models. Downstream reads use `?? []` / optional chaining.
				providers: z
					.array(z.object({ supports_tools: z.boolean().optional() }).passthrough())
					.nullish(),
				architecture: z
					.object({
						input_modalities: z.array(z.string()).optional(),
					})
					.passthrough()
					.nullish(),
			})
		),
	})
	.passthrough();

function getChatPromptRender(_m: ModelConfig): (inputs: ChatTemplateInput) => string {
	// Minimal template to support legacy "completions" flow if ever used.
	// We avoid any tokenizer/Jinja usage in this build.
	return ({ messages, preprompt }) => {
		const parts: string[] = [];
		if (preprompt) parts.push(`[SYSTEM]\n${preprompt}`);
		for (const msg of messages) {
			const role = msg.from === "assistant" ? "ASSISTANT" : msg.from.toUpperCase();
			parts.push(`[${role}]\n${msg.content}`);
		}
		parts.push(`[ASSISTANT]`);
		return parts.join("\n\n");
	};
}

const processModel = async (m: ModelConfig) => ({
	...m,
	chatPromptRender: await getChatPromptRender(m),
	id: m.id || m.name,
	displayName: m.displayName || m.name,
	preprompt: m.prepromptUrl ? await fetch(m.prepromptUrl).then((r) => r.text()) : m.preprompt,
	parameters: { ...m.parameters, stop_sequences: m.parameters?.stop },
	unlisted: m.unlisted ?? false,
});

const addEndpoint = (m: Awaited<ReturnType<typeof processModel>>) => ({
	...m,
	getEndpoint: async (): Promise<Endpoint> => {
		if (!m.endpoints || m.endpoints.length === 0) {
			throw new Error("No endpoints configured. This build requires OpenAI-compatible endpoints.");
		}
		const endpoint = m.endpoints[0];
		// OpenAI-compatible models (the catalog default) + the Public AI agent endpoint (Story B:
		// the hybrid Apertus agent service behind chat-ui's stream — see endpoints/agent/endpointAgent.ts).
		if (endpoint.type === "openai") {
			return await endpoints.openai({ ...endpoint, model: m });
		}
		if (endpoint.type === "agent") {
			return await endpoints.agent({ ...endpoint, model: m });
		}
		// Unreachable per the discriminated union (openai|agent both handled above); runtime-only guard.
		throw new Error(`Unsupported endpoint type '${(endpoint as { type: string }).type}' in this build`);
	},
});

type InternalProcessedModel = Awaited<ReturnType<typeof addEndpoint>> & {
	isRouter: boolean;
	hasInferenceAPI: boolean;
};

const inferenceApiIds: string[] = [];

const getModelOverrides = (): ModelOverride[] => {
	const overridesEnv = (Reflect.get(config, "MODELS") as string | undefined) ?? "";

	if (!overridesEnv.trim()) {
		return [];
	}

	try {
		return z.array(overrideEntrySchema).parse(JSON5.parse(sanitizeJSONEnv(overridesEnv, "[]")));
	} catch (error) {
		logger.error(error, "[models] Failed to parse MODELS overrides");
		return [];
	}
};

export type ProcessedModel = InternalProcessedModel;

export let models: ProcessedModel[] = [];
export let defaultModel!: ProcessedModel;
export let taskModel!: ProcessedModel;
export let validModelIdSchema: z.ZodType<string> = z.string();

const createValidModelIdSchema = (modelList: ProcessedModel[]): z.ZodType<string> => {
	if (modelList.length === 0) {
		throw new Error("No models available to build validation schema");
	}
	const ids = new Set(modelList.map((m) => m.id));
	return z.string().refine((value) => ids.has(value), "Invalid model id");
};

const resolveTaskModel = (modelList: ProcessedModel[]) => {
	if (modelList.length === 0) {
		throw new Error("No models available to select task model");
	}

	if (config.TASK_MODEL) {
		const preferred = modelList.find(
			(m) => m.name === config.TASK_MODEL || m.id === config.TASK_MODEL
		);
		if (preferred) {
			return preferred;
		}
	}

	return modelList[0];
};

const buildModels = async (): Promise<ProcessedModel[]> => {
	if (!openaiBaseUrl) {
		logger.error(
			"OPENAI_BASE_URL is required. Set it to an OpenAI-compatible base (e.g., https://router.huggingface.co/v1)."
		);
		throw new Error("OPENAI_BASE_URL not set");
	}

	try {
		const baseURL = openaiBaseUrl;
		logger.info({ baseURL }, "[models] Using OpenAI-compatible base URL");

		// Canonical auth token is OPENAI_API_KEY; keep HF_TOKEN as legacy alias
		const authToken = config.OPENAI_API_KEY || config.HF_TOKEN;

		// Use auth token from the start if available to avoid rate limiting issues
		// Some APIs rate-limit unauthenticated requests more aggressively
		const response = await fetch(`${baseURL}/models`, {
			headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
		});
		logger.info({ status: response.status }, "[models] First fetch status");
		if (!response.ok && response.status === 401 && !authToken) {
			// If we get 401 and didn't have a token, there's nothing we can do
			throw new Error(
				`Failed to fetch ${baseURL}/models: ${response.status} ${response.statusText} (no auth token available)`
			);
		}
		if (!response.ok) {
			throw new Error(
				`Failed to fetch ${baseURL}/models: ${response.status} ${response.statusText}`
			);
		}
		const json = await response.json();
		logger.info({ keys: Object.keys(json || {}) }, "[models] Response keys");

		const parsed = listSchema.parse(json);
		logger.info({ count: parsed.data.length }, "[models] Parsed models count");

		// Constrain the upstream router's full catalog to a curated allowlist. The Public AI
		// demonstrator serves Apertus; defaulting here keeps the model picker focused instead of
		// exposing all ~120 router models. Override with MODEL_ALLOWLIST (comma-separated ids); set it
		// to an empty string to expose the full catalog.
		// NOTE: the `config` Proxy returns "" for unset keys (not undefined), so test the trimmed value.
		// Unset/empty → default to Apertus; "*" or "all" → full catalog; otherwise the given id list.
		const allowlistRaw = ((Reflect.get(config, "MODEL_ALLOWLIST") as string | undefined) ?? "").trim();
		// 70B only for the alpha (user decision): the answer-quality layer
		// (persona/grounding/identity-lock) is tuned for the 70B, it's the default
		// served + tested model, and the 8B fails the identity-lock / confabulates.
		// Apertus 1.5 may be added here later if we get access. The first allowlisted
		// model becomes defaultModel (models[0]) below; with one entry the picker
		// collapses to a single model. Override via MODEL_ALLOWLIST if needed.
		const allowlistSpec = allowlistRaw || "swiss-ai/Apertus-70B-Instruct-2509";
		const exposeAll = ["*", "all"].includes(allowlistSpec.toLowerCase());
		const allowlist = allowlistSpec
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const allowSet = new Set(allowlist);
		let allowedData = parsed.data;
		if (!exposeAll && allowSet.size) {
			// Order by the allowlist, not the upstream router catalog order, so the
			// FIRST allowlisted id deterministically becomes defaultModel (models[0]).
			const byId = new Map(parsed.data.map((m) => [m.id, m]));
			const filtered = allowlist.map((id) => byId.get(id)).filter((m): m is typeof parsed.data[number] => Boolean(m));
			if (filtered.length) {
				allowedData = filtered;
				logger.info(
					{ kept: filtered.length, of: parsed.data.length },
					"[models] Constrained to model allowlist"
				);
			} else {
				logger.warn({ allowlist }, "[models] Allowlist matched nothing; using full catalog");
			}
		}

		let modelsRaw = allowedData.map((m) => {
			let logoUrl: string | undefined = undefined;
			if (isHFRouter && m.id.includes("/")) {
				const org = m.id.split("/")[0];
				logoUrl = `https://huggingface.co/api/avatars/${encodeURIComponent(org)}`;
			}

			const inputModalities = (m.architecture?.input_modalities ?? []).map((modality) =>
				modality.toLowerCase()
			);
			const supportsImageInput =
				inputModalities.includes("image") || inputModalities.includes("vision");

			// If any provider supports tools, consider the model as supporting tools
			const supportsTools = Boolean((m.providers ?? []).some((p) => p?.supports_tools === true));
			return {
				id: m.id,
				name: m.id,
				displayName: m.id,
				description: m.description,
				logoUrl,
				providers: m.providers,
				// TEXT-ONLY ALPHA: force non-multimodal regardless of what the served model advertises,
				// so the client never shows the image-attach affordance and no image is sent. Gated —
				// flip MULTIMODAL_ENABLED post-July. See $lib/server/textOnly.
				multimodal: MULTIMODAL_ENABLED && supportsImageInput,
				multimodalAcceptedMimetypes:
					MULTIMODAL_ENABLED && supportsImageInput ? ["image/*"] : undefined,
				supportsTools,
				endpoints: [
					{
						type: "openai" as const,
						baseURL,
						// apiKey will be taken from OPENAI_API_KEY or HF_TOKEN automatically
					},
				],
			} as ModelConfig;
		}) as ModelConfig[];

		const overrides = getModelOverrides();

		if (overrides.length) {
			const overrideMap = new Map<string, ModelOverride>();
			for (const override of overrides) {
				for (const key of [override.id, override.name]) {
					const trimmed = key?.trim();
					if (trimmed) overrideMap.set(trimmed, override);
				}
			}

			modelsRaw = modelsRaw.map((model) => {
				const override = overrideMap.get(model.id ?? "") ?? overrideMap.get(model.name ?? "");
				if (!override) return model;

				const { id, name, ...rest } = override;
				void id;
				void name;

				return {
					...model,
					...rest,
				};
			});
		}

		const builtModels = await Promise.all(
			modelsRaw.map((e) =>
				processModel(e)
					.then(addEndpoint)
					.then(async (m) => ({
						...m,
						hasInferenceAPI: inferenceApiIds.includes(m.id ?? m.name),
						// router decoration added later
						isRouter: false as boolean,
					}))
			)
		);

		const routerRoutesPath = (config.LLM_ROUTER_ROUTES_PATH || "").trim();
		const routerLabel = (config.PUBLIC_LLM_ROUTER_DISPLAY_NAME || "Omni").trim() || "Omni";
		const routerLogo = (config.PUBLIC_LLM_ROUTER_LOGO_URL || "").trim();
		const routerAliasId = (config.PUBLIC_LLM_ROUTER_ALIAS_ID || "omni").trim() || "omni";
		const routerMultimodalEnabled =
			(config.LLM_ROUTER_ENABLE_MULTIMODAL || "").toLowerCase() === "true";
		const routerToolsEnabled = (config.LLM_ROUTER_ENABLE_TOOLS || "").toLowerCase() === "true";

		let decorated = builtModels as ProcessedModel[];

		if (routerRoutesPath) {
			// Build a minimal model config for the alias
			const aliasRaw = {
				id: routerAliasId,
				name: routerAliasId,
				displayName: routerLabel,
				description: "Automatically routes your messages to the best model for your request.",
				logoUrl: routerLogo || undefined,
				preprompt: "",
				endpoints: [
					{
						type: "openai" as const,
						baseURL: openaiBaseUrl,
					},
				],
				// Keep the alias visible
				unlisted: false,
			} as ModelConfig;

			if (MULTIMODAL_ENABLED && routerMultimodalEnabled) {
				aliasRaw.multimodal = true;
				aliasRaw.multimodalAcceptedMimetypes = ["image/*"];
			}

			if (routerToolsEnabled) {
				aliasRaw.supportsTools = true;
			}

			// Apply MODELS overrides to the router alias too, so flags like
			// supportsArtifacts can be set on it like on any other model
			const aliasOverride = getModelOverrides().find(
				(o) => o.id?.trim() === routerAliasId || o.name?.trim() === routerAliasId
			);
			if (aliasOverride) {
				const { id, name, ...rest } = aliasOverride;
				void id;
				void name;
				Object.assign(aliasRaw, rest);
			}

			const aliasBase = await processModel(aliasRaw);
			// Create a self-referential ProcessedModel for the router endpoint
			const aliasModel: ProcessedModel = {
				...aliasBase,
				isRouter: true,
				hasInferenceAPI: false,
				// getEndpoint uses the router wrapper regardless of the endpoints array
				getEndpoint: async (): Promise<Endpoint> => makeRouterEndpoint(aliasModel),
			} as ProcessedModel;

			// Put alias first
			decorated = [aliasModel, ...decorated];
		}

		// Public AI agent (Story B): expose the hybrid Apertus agent service as a model in the picker.
		// Gated by AGENT_SERVICE_URL so it appears ONLY where configured (off by default → safe for the
		// alpha; setting the env turns it on). The agent endpoint streams the service's /run + SSE into
		// chat-ui's token stream (plan/steps as a <think> block, verified result as the answer).
		const agentUrl = ((Reflect.get(config, "AGENT_SERVICE_URL") as string | undefined) ?? "").trim();
		if (agentUrl) {
			const agentToken = ((Reflect.get(config, "AGENT_SERVICE_TOKEN") as string | undefined) ?? "").trim();
			const agentModelName =
				((Reflect.get(config, "AGENT_SERVICE_MODEL") as string | undefined) ?? "").trim() ||
				"swiss-ai/Apertus-70B-Instruct-2509";
			const agentRaw = {
				id: "apertus-agent",
				name: "apertus-agent",
				displayName:
					((Reflect.get(config, "AGENT_SERVICE_DISPLAY_NAME") as string | undefined) ?? "").trim() ||
					"Apertus Agent (beta)",
				description:
					"Runs your task as a multi-step agent on the fully-open Apertus model (hybrid), sandboxed and metered server-side. Shows its plan + steps as it works.",
				preprompt: "",
				endpoints: [
					{
						type: "agent" as const,
						baseURL: agentUrl,
						apiKey: agentToken,
						provenanceModel: agentModelName,
					},
				],
				unlisted: false,
			} as ModelConfig;
			const agentModel = {
				...addEndpoint(await processModel(agentRaw)),
				isRouter: false as boolean,
				hasInferenceAPI: false,
			} as ProcessedModel;
			decorated = [...decorated, agentModel];
			logger.info({ baseURL: agentUrl }, "[models] Registered Public AI agent model (apertus-agent)");
		}

		// Second-opinion model (capable open reasoner on a DIFFERENT provider). The
		// sovereign Apertus primary stays on its own base (CSCS); this registers a
		// more-capable open-weights model — e.g. GLM-5.2 on the HF router — as its
		// OWN endpoint (its own baseURL + key), so a user-requested "second opinion"
		// runs through the native per-model-endpoint machinery with honest provenance
		// (no duplicate client, no closed provider). Unlisted: it's an escalation
		// target, not a primary chat choice. Gated on SECOND_OPINION_* so it appears
		// only where configured (off by default → safe for the alpha).
		const soBaseURL = ((Reflect.get(config, "SECOND_OPINION_BASE_URL") as string | undefined) ?? "").trim();
		const soModelId = ((Reflect.get(config, "SECOND_OPINION_MODEL") as string | undefined) ?? "").trim();
		const soApiKey = ((Reflect.get(config, "SECOND_OPINION_API_KEY") as string | undefined) ?? "").trim();
		if (soBaseURL && soModelId && soApiKey) {
			const soRaw = {
				id: soModelId,
				name: soModelId,
				displayName:
					((Reflect.get(config, "SECOND_OPINION_DISPLAY_NAME") as string | undefined) ?? "").trim() ||
					soModelId.split("/").pop() ||
					soModelId,
				description:
					"A more capable open-weights model, offered as an opt-in second opinion on hard reasoning turns. Open weights, served on a non-sovereign provider — labeled as such.",
				preprompt: "",
				endpoints: [
					{
						type: "openai" as const,
						baseURL: soBaseURL.replace(/\/$/, ""),
						apiKey: soApiKey,
					},
				],
				// escalation target, not a primary choice
				unlisted: true,
			} as ModelConfig;
			const soModel = {
				...addEndpoint(await processModel(soRaw)),
				isRouter: false as boolean,
				hasInferenceAPI: false,
			} as ProcessedModel;
			decorated = [...decorated, soModel];
			logger.info({ baseURL: soBaseURL, model: soModelId }, "[models] Registered second-opinion model");
		}

		return decorated;
	} catch (e) {
		logger.error(e, "Failed to load models from OpenAI base URL");
		throw e;
	}
};

// Skip the initial fetch during `vite build`: SvelteKit's analyse phase imports this
// module, and hitting the live router from CI builds fails on rate limits (429).
// The model list is built once at server startup; new models appear on redeploy.
if (!building) {
	const startedAt = Date.now();
	const newModels = await buildModels();
	if (newModels.length === 0) {
		throw new Error("Failed to load any models from upstream");
	}

	models = newModels;
	defaultModel = models[0];
	taskModel = resolveTaskModel(models);
	validModelIdSchema = createValidModelIdSchema(models);

	logger.info(
		{ total: models.length, durationMs: Date.now() - startedAt },
		"[models] Model cache built"
	);
}

export const validateModel = (_models: BackendModel[]) => {
	// Zod enum function requires 2 parameters
	return z.enum([_models[0].id, ..._models.slice(1).map((m) => m.id)]);
};

// if `TASK_MODEL` is string & name of a model in `MODELS`, then we use `MODELS[TASK_MODEL]`, else we try to parse `TASK_MODEL` as a model config itself

export type BackendModel = Optional<
	typeof defaultModel,
	"preprompt" | "parameters" | "multimodal" | "unlisted" | "hasInferenceAPI"
>;
