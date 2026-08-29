import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const gpustack = createOpenAICompatible({
  name: "gpustack",
  apiKey: process.env.LLM_API_KEY!,
  baseURL: process.env.LLM_BASE_URL!,
});

export function getModel() {
  return gpustack(process.env.LLM_MODEL_PREFERRED || "mm-l2");
}

export function getModelFallback() {
  return gpustack(process.env.LLM_MODEL_FALLBACK || "mm-l1");
}
