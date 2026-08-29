import { createTextStreamResponse } from "ai";
import { streamLLMResponse } from "./stream";
import { generateStructured } from "./generate";
import {
  systemPrompt as detailSystemPrompt,
  buildUserPrompt as buildDetailUserPrompt,
} from "@/lib/prompts/knowledge-detail";
import {
  systemPrompt as exampleSystemPrompt,
  exampleSchema,
  type ExampleProblems,
} from "@/lib/prompts/example-problems";
import {
  systemPrompt as practiceSystemPrompt,
  practiceSchema,
  type PracticeQuiz,
} from "@/lib/prompts/practice-quiz";
import {
  cacheContent,
  getCachedContent,
  getKnowledgePoint,
} from "@/lib/db/knowledge-queries";

export class KnowledgePointNotFoundError extends Error {
  constructor(public readonly kpId: number) {
    super(`Knowledge point not found: ${kpId}`);
    this.name = "KnowledgePointNotFoundError";
  }
}

export interface StreamResponseResult {
  toTextStreamResponse(init?: ResponseInit): Response;
}

function gradeLabel(gradeLevel: number | null): string {
  return gradeLevel != null ? `Grade ${gradeLevel}` : "K12";
}

function stringToTextStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}

function cachedTextResponse(text: string): Response {
  return createTextStreamResponse({ stream: stringToTextStream(text) });
}

async function requireKnowledgePoint(kpId: number) {
  const kp = await getKnowledgePoint(kpId);
  if (!kp) throw new KnowledgePointNotFoundError(kpId);
  return kp;
}

export async function generateCoreIntro(
  kpId: number
): Promise<StreamResponseResult> {
  const cached = await getCachedContent(kpId, "intro");
  if (typeof cached === "string" && cached.length > 0) {
    return { toTextStreamResponse: () => cachedTextResponse(cached) };
  }

  const kp = await requireKnowledgePoint(kpId);
  const prompt =
    `${buildDetailUserPrompt(kp.title, gradeLabel(kp.grade_level))}\n\n` +
    `Keep the introduction concise and focused on the core concept with one brief intuitive example.`;

  const result = await streamLLMResponse(detailSystemPrompt, prompt);
  void Promise.resolve(result.text)
    .then((fullText) => cacheContent(kpId, "intro", fullText))
    .catch(() => {});
  return result;
}

export async function generateDetail(
  kpId: number
): Promise<StreamResponseResult> {
  const cached = await getCachedContent(kpId, "detail");
  if (typeof cached === "string" && cached.length > 0) {
    return { toTextStreamResponse: () => cachedTextResponse(cached) };
  }

  const kp = await requireKnowledgePoint(kpId);
  const prompt =
    `${buildDetailUserPrompt(kp.title, gradeLabel(kp.grade_level))}\n\n` +
    `Provide an in-depth, comprehensive explanation with multiple worked examples and thorough coverage of common pitfalls.`;

  const result = await streamLLMResponse(detailSystemPrompt, prompt);
  void Promise.resolve(result.text)
    .then((fullText) => cacheContent(kpId, "detail", fullText))
    .catch(() => {});
  return result;
}

export async function generateExamples(
  kpId: number
): Promise<ExampleProblems> {
  const cached = await getCachedContent(kpId, "examples");
  if (cached && typeof cached === "object") {
    return cached as ExampleProblems;
  }

  const kp = await requireKnowledgePoint(kpId);
  const prompt = `Please generate worked example problems for the following knowledge point.

Knowledge point title: ${kp.title}
Target grade: ${gradeLabel(kp.grade_level)}

Provide 3 examples covering easy, medium, and hard difficulty. For each, include the question, a full step-by-step solution, a clear explanation of each step, and a difficulty label.`;

  const result = await generateStructured<ExampleProblems>(
    exampleSystemPrompt,
    prompt,
    exampleSchema
  );
  await cacheContent(kpId, "examples", result);
  return result;
}

export async function generatePractice(
  kpId: number
): Promise<PracticeQuiz> {
  const cached = await getCachedContent(kpId, "practice");
  if (cached && typeof cached === "object") {
    return cached as PracticeQuiz;
  }

  const kp = await requireKnowledgePoint(kpId);
  const prompt = `Please generate a practice quiz for the following knowledge point.

Knowledge point title: ${kp.title}
Target grade: ${gradeLabel(kp.grade_level)}

Provide 5 single-choice questions. Each question must have exactly 4 choices, the correct answer as a zero-based index into the choices array, and an explanation of why it is correct. Give each question a unique string id.`;

  const result = await generateStructured<PracticeQuiz>(
    practiceSystemPrompt,
    prompt,
    practiceSchema
  );
  await cacheContent(kpId, "practice", result);
  return result;
}
