import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

// Apertus — open-source model. The serving PATH is env-switchable; either way
// it's the same open Apertus (honors the rule: in-app inference must run on an
// open-source model).
//
// DEFAULT = the HuggingFace router. It's proven and reliable, so it ships by
// default and is what people dogfood today — the chat must stay reliable for
// users, so the sovereign path is opt-in until it's validated end-to-end.
//
// Public AI's own sovereign endpoint (api.publicai.co — verified serving
// Apertus-70B) is wired and ready but kept behind the flag until validated at
// demo scale. Cut over with SERVING_PROVIDER=publicai (+ PUBLICAI_API_KEY) — no
// code change; HF is the fallback you re-enable by clearing the flag.
const useSovereign =
  process.env.SERVING_PROVIDER === "publicai" && !!process.env.PUBLICAI_API_KEY;

const serving = useSovereign
  ? {
      baseURL: process.env.PUBLICAI_BASE_URL ?? "https://api.publicai.co/v1",
      apiKey: process.env.PUBLICAI_API_KEY ?? "",
      // The sovereign endpoint expects the lowercase id (the HF-style
      // "swiss-ai/Apertus-70B-Instruct-2509" 401s as model-not-allowed there).
      model: process.env.PUBLICAI_MODEL ?? "swiss-ai/apertus-70b-instruct",
    }
  : {
      baseURL: process.env.HF_BASE_URL ?? "https://router.huggingface.co/v1",
      apiKey: process.env.HF_TOKEN ?? "",
      model: process.env.HF_MODEL ?? "swiss-ai/Apertus-70B-Instruct-2509",
    };

// Which path is live — exported (not secret) so the route can emit honest
// per-answer provenance: the sovereign endpoint does NOT send HF's
// `x-inference-provider` header, so the badge needs to know the path.
export const servingProvider: "hf" | "publicai" = useSovereign
  ? "publicai"
  : "hf";

const apertus = createOpenAICompatible({
  name: "apertus",
  baseURL: serving.baseURL,
  apiKey: serving.apiKey,
});

const APERTUS_MODEL = serving.model;

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  // All in-app inference runs on the open Apertus model, regardless of id.
  return apertus(APERTUS_MODEL);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return apertus(APERTUS_MODEL);
}
