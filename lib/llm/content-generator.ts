import { createTextStreamResponse } from "ai";
import { streamLLMResponse } from "./stream";
import { generateStructured } from "./generate";
import {
  systemPrompt as contentSystemPrompt,
  allContentSchema,
  buildAllContentPrompt,
  type AllContent,
} from "@/lib/prompts/knowledge-content";
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
  if (gradeLevel == null) return "中小学";
  if (gradeLevel <= 5) return `小学${gradeLevel}年级`;
  if (gradeLevel <= 9) return `初中${gradeLevel - 5}年级`;
  return `高中${gradeLevel - 9}年级`;
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

/**
 * 一次性生成知识点的全部教学内容（核心概念+详细讲解+例题），缓存后按字段返回。
 * 练习题仍由 generatePractice 单独动态生成。
 */
export async function generateAllContent(kpId: number): Promise<AllContent> {
  // 先查缓存
  const cached = await getCachedContent(kpId, "all_content");
  if (cached && typeof cached === "object") {
    return cached as AllContent;
  }

  const kp = await requireKnowledgePoint(kpId);
  const prompt = buildAllContentPrompt(
    kp.title,
    gradeLabel(kp.grade_level)
  );

  const result = await generateStructured<AllContent>(
    contentSystemPrompt,
    prompt,
    allContentSchema
  );

  // 缓存后下次秒读
  await cacheContent(kpId, "all_content", result);
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
