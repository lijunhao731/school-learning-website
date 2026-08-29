import { generateStructured } from "./generate";
import {
  systemPrompt,
  errorSchema,
  type ErrorAnalysis,
} from "@/lib/prompts/error-analysis";
import { pool } from "@/lib/db/client";

export interface AnalyzeErrorParams {
  ocrText: string;
  ocrFormulas?: { latex: string }[];
  studentAnswer?: string;
  /** Reserved for future vision-capable LLM support; not sent to the LLM currently. */
  imageBase64?: string;
  userGrade?: number;
  userId?: number;
  kpId?: number;
  imageUrl?: string;
}

function buildUserPrompt(params: AnalyzeErrorParams): string {
  const formulasText =
    params.ocrFormulas?.map((f) => f.latex).join(", ") ?? "无";

  return `请分析以下学生错题：

题目文字：${params.ocrText}
数学公式：${formulasText}
学生答案：${params.studentAnswer ?? "未提供"}
学生年级：${params.userGrade ?? "未指定"}

分析题目的错误原因、解题思路，并标注相关知识点。`;
}

export type AnalyzedError = ErrorAnalysis & { mistakeId: number | null };

export async function analyzeError(
  params: AnalyzeErrorParams
): Promise<AnalyzedError> {
  const { ocrText, ocrFormulas, studentAnswer, userGrade, userId, kpId, imageUrl } =
    params;

  const userPrompt = buildUserPrompt(params);
  const result = await generateStructured<ErrorAnalysis>(
    systemPrompt,
    userPrompt,
    errorSchema
  );

  let mistakeId: number | null = null;
  if (userId != null) {
    const insertRes = await pool.query(
      `INSERT INTO mistakes (user_id, kp_id, image_url, ocr_text, student_answer, error_cause, solution_approach, related_kp_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId,
        kpId ?? null,
        imageUrl ?? null,
        ocrText,
        studentAnswer ?? null,
        result.errorCause,
        result.solutionApproach,
        result.relatedKpIds,
      ]
    );
    const row = insertRes.rows[0] as { id: number } | undefined;
    mistakeId = row?.id ?? null;
  }

  return { ...result, mistakeId };
}
