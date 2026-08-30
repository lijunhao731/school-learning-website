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
  return gradeLevel != null ? `小学${gradeLevel}年级` : "中小学";
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
    `请简明扼要地介绍核心概念，举一个直观易懂的例子。用中文回答。`;

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
    `请提供深入、全面的讲解，包含多个详细例题，并充分覆盖常见易错点。用中文回答。`;

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
  const prompt = `请为以下知识点生成例题。

知识点标题：${kp.title}
目标年级：${gradeLabel(kp.grade_level)}

请提供3道例题，分别涵盖简单、中等、较难难度。每道题需包含题目、完整分步解答、每一步的解释说明、以及难度标签。所有内容用中文呈现。`;

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
  const prompt = `请为以下知识点生成练习题。

知识点标题：${kp.title}
目标年级：${gradeLabel(kp.grade_level)}

请提供5道单选题。每道题必须恰好有4个选项，以零基索引标明正确答案在 choices 数组中的位置，并解释为什么该答案正确。每道题需有唯一的字符串 id。所有内容用中文呈现。`;

  const result = await generateStructured<PracticeQuiz>(
    practiceSystemPrompt,
    prompt,
    practiceSchema
  );
  await cacheContent(kpId, "practice", result);
  return result;
}
