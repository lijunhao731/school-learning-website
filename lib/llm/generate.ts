import { generateObject } from "ai";
import { getModel } from "./client";
import type { z } from "zod";

export async function generateStructured<T>(
  system: string,
  prompt: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal
) {
  const { object } = await generateObject({
    model: getModel(),
    system,
    prompt,
    schema,
    abortSignal: signal,
  });
  return object;
}
