import { generateStructured } from "@/lib/llm/generate";
import {
  systemPrompt,
  similarSchema,
  type SimilarQuestions,
} from "@/lib/prompts/similar-questions";
import { pool } from "@/lib/db/client";

export interface SimilarQuestionParams {
  originalQuestion: string;
  errorCause?: { type: string; description: string };
  relatedKpIds?: string[];
  /** Number of questions to generate. Defaults to 3, clamped to [3, 5]. */
  count?: number;
  userId: number;
  mistakeId?: number;
  kpId?: number;
}

function clampCount(count: number | undefined): number {
  if (count == null || !Number.isFinite(count)) return 3;
  const rounded = Math.round(count);
  if (rounded < 3) return 3;
  if (rounded > 5) return 5;
  return rounded;
}

function buildUserPrompt(
  params: SimilarQuestionParams,
  count: number
): string {
  const errorType = params.errorCause?.type ?? "未知";
  const errorDesc = params.errorCause?.description ?? "无";
  const relatedKp = params.relatedKpIds?.join(", ") ?? "未指定";

  return `请基于以下错题生成 ${count} 道相似选择题：

原始题目：${params.originalQuestion}
错误类型：${errorType}
错误描述：${errorDesc}
相关知识点：${relatedKp}

要求：
1. 生成 ${count} 道与原题相似但不同的选择题，不得与原题完全相同
2. 基于学生常见错误（${errorType}）设计有迷惑性的干扰项（misconception-based distractors）
3. 每题恰好 1 个正确答案 + 3 个错误选项
4. 至少 1 个干扰项针对学生的具体错误类型「${errorType}」
5. 至少 1 个干扰项具有较强迷惑性，避免所有错误选项都明显错误
6. 题目难度与原题相近或略低
7. 每题为 single-choice 类型，并给出解析与所针对的知识点`;
}

export async function generateSimilarQuestions(
  params: SimilarQuestionParams
): Promise<SimilarQuestions> {
  const { count, userId, kpId } = params;

  const questionCount = clampCount(count);
  const userPrompt = buildUserPrompt(params, questionCount);

  const result = await generateStructured<SimilarQuestions>(
    systemPrompt,
    userPrompt,
    similarSchema
  );

  // review_item_id references review_items.id; a mistake id belongs to the
  // mistakes table and cannot be used here, so it is left NULL.
  await pool.query(
    `INSERT INTO quiz_attempts (user_id, kp_id, quiz_data, generated_from, review_item_id)
     VALUES ($1, $2, $3, 'similar', $4)`,
    [userId, kpId ?? null, result, null]
  );

  return result;
}
