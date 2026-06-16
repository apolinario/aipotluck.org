import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

// Apertus — open-source model served via the HuggingFace router (OpenAI-compatible).
// Honors the project rule: in-app inference must run on an open-source model.
const apertus = createOpenAICompatible({
  name: "apertus",
  baseURL: process.env.HF_BASE_URL ?? "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN ?? "",
});

const APERTUS_MODEL =
  process.env.HF_MODEL ?? "swiss-ai/Apertus-70B-Instruct-2509";

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
