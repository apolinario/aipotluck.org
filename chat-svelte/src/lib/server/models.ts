import { building } from "$app/environment";
import { config } from "$lib/server/config";
import { MULTIMODAL_ENABLED } from "$lib/server/textOnly";
import type { ChatTemplateInput } from "$lib/types/Template";
import { z } from "zod";
import endpoints, { endpointSchema } from "./endpoints/endpoints";
import type { Endpoint } from "./endpoints/types";

import JSON5 from "json5";
import { logger } from "$lib/server/logger";
import { makeRouterEndpoint } from "$lib/server/router/endpoint";
import { sanitizeJSONEnv } from "$lib/server/envParse";
import { applyOverrides, selectAllowedModels, toModelConfigs } from "$lib/server/modelsCatalog";

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

export type ModelConfig = z.infer<typeof modelConfig>;

const overrideEntrySchema = modelConfig
	.partial()
	.extend({
		id: z.string().optional(),
		name: z.string().optional(),
	})
	.refine((value) => Boolean((value.id ?? value.name)?.trim()), {
		message: "Model override entry must provide an id or name",
	});

export type ModelOverride = z.infer<typeof overrideEntrySchema>;

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

export type CatalogEntry = z.infer<typeof listSchema>["data"][number];

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
		throw new Error(
			`Unsupported endpoint type '${(endpoint as { type: string }).type}' in this build`
		);
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

// Resolve the curated allowlist policy string. The `config` Proxy returns "" for unset keys (not
// undefined), so test the trimmed value. Unset/empty → default to Apertus 70B; "*"/"all" → full
// catalog; otherwise the comma-separated id list (see selectAllowedModels). 70B only for the alpha
// (user decision): the answer-quality layer (persona/grounding/identity-lock) is tuned for the 70B,
// it's the default served + tested model, and the 8B fails the identity-lock / confabulates. Newer
// Apertus checkpoints may be added here later. The first allowlisted model becomes defaultModel
// (models[0]); with one entry the picker collapses to a single model.
const resolveAllowlistSpec = (): string => {
	const allowlistRaw = (
		(Reflect.get(config, "MODEL_ALLOWLIST") as string | undefined) ?? ""
	).trim();
	return allowlistRaw || "swiss-ai/Apertus-70B-Instruct-2509";
};

// Fetch + validate the upstream OpenAI-compatible /models catalog.
const fetchModelCatalog = async (baseURL: string): Promise<CatalogEntry[]> => {
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
		throw new Error(`Failed to fetch ${baseURL}/models: ${response.status} ${response.statusText}`);
	}
	const json = await response.json();
	logger.info({ keys: Object.keys(json || {}) }, "[models] Response keys");

	const parsed = listSchema.parse(json);
	logger.info({ count: parsed.data.length }, "[models] Parsed models count");
	return parsed.data;
};

// Process + endpoint-decorate the shaped configs into ProcessedModels (router flag added later).
const processConfigs = async (modelsRaw: ModelConfig[]): Promise<ProcessedModel[]> => {
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
	return builtModels as ProcessedModel[];
};

// Prepend the LLM-router alias (Omni) when LLM_ROUTER_ROUTES_PATH is configured.
const maybeAddRouterAlias = async (
	decorated: ProcessedModel[],
	baseURL: string
): Promise<ProcessedModel[]> => {
	const routerRoutesPath = (config.LLM_ROUTER_ROUTES_PATH || "").trim();
	if (!routerRoutesPath) {
		return decorated;
	}

	const routerLabel = (config.PUBLIC_LLM_ROUTER_DISPLAY_NAME || "Omni").trim() || "Omni";
	const routerLogo = (config.PUBLIC_LLM_ROUTER_LOGO_URL || "").trim();
	const routerAliasId = (config.PUBLIC_LLM_ROUTER_ALIAS_ID || "omni").trim() || "omni";
	const routerMultimodalEnabled =
		(config.LLM_ROUTER_ENABLE_MULTIMODAL || "").toLowerCase() === "true";
	const routerToolsEnabled = (config.LLM_ROUTER_ENABLE_TOOLS || "").toLowerCase() === "true";

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
				baseURL,
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
	return [aliasModel, ...decorated];
};

// Append the Public AI agent model (Story B) when AGENT_SERVICE_URL is configured. Gated so it
// appears ONLY where configured (off by default → safe for the alpha). The agent endpoint streams
// the service's /run + SSE into chat-ui's token stream (plan/steps as a <think> block, verified
// result as the answer).
const maybeAddAgentModel = async (decorated: ProcessedModel[]): Promise<ProcessedModel[]> => {
	const agentUrl = ((Reflect.get(config, "AGENT_SERVICE_URL") as string | undefined) ?? "").trim();
	if (!agentUrl) {
		return decorated;
	}

	const agentToken = (
		(Reflect.get(config, "AGENT_SERVICE_TOKEN") as string | undefined) ?? ""
	).trim();
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
	logger.info({ baseURL: agentUrl }, "[models] Registered Public AI agent model (apertus-agent)");
	return [...decorated, agentModel];
};

// Append the opt-in compare/second-opinion panel when SECOND_OPINION_* is configured. Independent
// open models on a DIFFERENT provider: the sovereign Apertus primary stays on its own base (CSCS);
// these register the ordered "compare with another model" stack — a SECOND opinion (e.g. GLM-5.2)
// and an optional THIRD (e.g. Mistral Large 3) — each as an unlisted per-model endpoint with honest
// provenance, all riding the SAME compare endpoint (same baseURL + key, different model id). Neutral
// triangulation, not "a more capable model" (we don't assert a hierarchy). Off by default → safe for
// the alpha; the third is dormant until THIRD_OPINION_MODEL is set.
const maybeAddCompareModels = async (decorated: ProcessedModel[]): Promise<ProcessedModel[]> => {
	const soBaseURL = (
		(Reflect.get(config, "SECOND_OPINION_BASE_URL") as string | undefined) ?? ""
	).trim();
	const soApiKey = (
		(Reflect.get(config, "SECOND_OPINION_API_KEY") as string | undefined) ?? ""
	).trim();
	// The panel = COMPARE_PANEL (comma-separated, for the collective fanout) when set, else the
	// sequential [SECOND, THIRD] pair. Plus the AGGREGATOR_MODEL (the verdict writer) if it isn't
	// already a panelist. All ride the same compare endpoint.
	const secondId = (
		(Reflect.get(config, "SECOND_OPINION_MODEL") as string | undefined) ?? ""
	).trim();
	const thirdId = ((Reflect.get(config, "THIRD_OPINION_MODEL") as string | undefined) ?? "").trim();
	const panelRaw = ((Reflect.get(config, "COMPARE_PANEL") as string | undefined) ?? "").trim();
	const aggId = ((Reflect.get(config, "AGGREGATOR_MODEL") as string | undefined) ?? "").trim();
	const panelIds = panelRaw
		? panelRaw
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: [secondId, thirdId].filter(Boolean);
	// Display-name hints for the two named singles; panel ids derive a name from the id.
	const nameHints: Record<string, string> = {};
	const secondName = (
		(Reflect.get(config, "SECOND_OPINION_DISPLAY_NAME") as string | undefined) ?? ""
	).trim();
	const thirdName = (
		(Reflect.get(config, "THIRD_OPINION_DISPLAY_NAME") as string | undefined) ?? ""
	).trim();
	if (secondId && secondName) nameHints[secondId] = secondName;
	if (thirdId && thirdName) nameHints[thirdId] = thirdName;
	const compareIds = [...new Set([...panelIds, ...(aggId ? [aggId] : [])])];
	if (!(soBaseURL && soApiKey && compareIds.length)) {
		return decorated;
	}

	let result = decorated;
	for (const id of compareIds) {
		const raw = {
			id,
			name: id,
			displayName: nameHints[id] || id.split("/").pop() || id,
			description:
				"An independent open-weights model, offered as an opt-in cross-check (compare with another model / collective second opinion). Open weights, served on a non-sovereign provider — labeled as such.",
			preprompt: "",
			endpoints: [
				{
					type: "openai" as const,
					baseURL: soBaseURL.replace(/\/$/, ""),
					apiKey: soApiKey,
				},
			],
			// compare/panel target, not a primary choice
			unlisted: true,
		} as ModelConfig;
		const model = {
			...addEndpoint(await processModel(raw)),
			isRouter: false as boolean,
			hasInferenceAPI: false,
		} as ProcessedModel;
		result = [...result, model];
		logger.info({ baseURL: soBaseURL, model: id }, "[models] Registered compare model");
	}
	return result;
};

const buildModels = async (): Promise<ProcessedModel[]> => {
	if (!openaiBaseUrl) {
		logger.error(
			"OPENAI_BASE_URL is required. Set it to an OpenAI-compatible base (e.g., https://router.huggingface.co/v1)."
		);
		throw new Error("OPENAI_BASE_URL not set");
	}
	const baseURL = openaiBaseUrl;

	try {
		const catalog = await fetchModelCatalog(baseURL);

		// Constrain the upstream router's full catalog to a curated allowlist, shape the survivors into
		// model configs, then layer MODELS overrides on top (see $lib/server/modelsCatalog).
		const allowed = selectAllowedModels(catalog, resolveAllowlistSpec());
		const configs = applyOverrides(
			toModelConfigs(allowed, { baseURL, isHFRouter, multimodalEnabled: MULTIMODAL_ENABLED }),
			getModelOverrides()
		);

		let decorated = await processConfigs(configs);
		decorated = await maybeAddRouterAlias(decorated, baseURL);
		decorated = await maybeAddAgentModel(decorated);
		decorated = await maybeAddCompareModels(decorated);
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
