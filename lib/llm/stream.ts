import { streamText } from "ai";
import { getModel } from "./client";

export async function streamLLMResponse(
  system: string,
  prompt: string,
  signal?: AbortSignal
) {
  return streamText({ model: getModel(), system, prompt, abortSignal: signal });
}
