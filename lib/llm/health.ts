import { getModel, getModelFallback } from "./client";

export interface LLMHealthStatus {
  available: boolean;
  models: string[];
  error?: string;
}

async function fetchModels(baseURL: string | undefined, apiKey: string | undefined) {
  if (!baseURL) {
    throw new Error("LLM_BASE_URL is not configured");
  }
  const modelsUrl = baseURL.replace(/\/$/, "").endsWith("/v1")
    ? `${baseURL.replace(/\/$/, "")}/models`
    : `${baseURL.replace(/\/$/, "")}/v1/models`;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(modelsUrl, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM health check failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { data?: Array<{ id: string }> };
  const models = Array.isArray(data?.data)
    ? data.data.map((m) => m.id).filter((id): id is string => typeof id === "string")
    : [];
  return models;
}

export async function checkLLMHealth(): Promise<LLMHealthStatus> {
  const baseURL = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;

  try {
    const models = await fetchModels(baseURL, apiKey);
    return { available: true, models };
  } catch (primaryError) {
    const fallbackError = primaryError as Error;
    try {
      const fallbackModel = getModelFallback();
      const fallbackBase =
        (fallbackModel as unknown as { baseURL?: string })?.baseURL ?? baseURL;
      const models = await fetchModels(fallbackBase ?? baseURL, apiKey);
      void fallbackModel;
      return { available: true, models };
    } catch {
      return {
        available: false,
        models: [],
        error: fallbackError?.message ?? String(primaryError),
      };
    }
  }
}
