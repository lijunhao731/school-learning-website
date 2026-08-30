import { generateText } from "ai";
import { getModel } from "./client";
import type { z } from "zod";

/**
 * Generate structured JSON from the LLM using plain text completion.
 *
 * Uses generateText + manual JSON extraction instead of generateObject,
 * because GPUStack/vLLM does not support responseFormat (JSON schema)
 * for all models. The system prompt instructs the model to return JSON,
 * and we extract + validate it here.
 */
export async function generateStructured<T>(
  system: string,
  prompt: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal
): Promise<T> {
  const jsonInstruction = `${system}\n\nYou MUST respond with ONLY valid JSON matching this structure. Do not include any markdown, code fences, or explanatory text outside the JSON.`;

  const { text } = await generateText({
    model: getModel(),
    system: jsonInstruction,
    prompt,
    abortSignal: signal,
  });

  // Extract JSON from the response (handle markdown code fences or extra text)
  const jsonStr = extractJson(text);
  if (!jsonStr) {
    throw new Error("LLM did not return valid JSON");
  }

  const parsed = JSON.parse(jsonStr);
  return schema.parse(parsed);
}

/**
 * Extract a JSON object/array from a text string that may contain
 * markdown code fences or surrounding prose.
 */
function extractJson(text: string): string | null {
  // Try direct parse first
  try {
    JSON.parse(text);
    return text.trim();
  } catch {
    // continue
  }

  // Try extracting from ```json ... ``` fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    try {
      JSON.parse(fenceMatch[1]);
      return fenceMatch[1].trim();
    } catch {
      // continue
    }
  }

  // Try finding the first { or [ and matching the last } or ]
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let start = -1;
  let endChar = "";

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    endChar = "}";
  } else if (firstBracket !== -1) {
    start = firstBracket;
    endChar = "]";
  }

  if (start === -1) return null;

  const lastEnd = text.lastIndexOf(endChar);
  if (lastEnd > start) {
    const candidate = text.slice(start, lastEnd + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  return null;
}
