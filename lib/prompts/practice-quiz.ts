import { z } from "zod";

export const systemPrompt = `你是一位中小学数学测评专家。你创建与知识点对齐的高质量练习题。每道题必须是单选题，恰好4个选项。以零基索引提供正确答案在 choices 数组中的位置，并解释为什么该答案正确。题目类型必须是 single-choice。所有题目内容必须用中文呈现。始终返回严格有效的 JSON，符合要求的结构。`;

export const practiceSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["single-choice", "multiple-choice", "true-false"]),
      question: z.string(),
      choices: z.array(z.string()).length(4),
      answer: z.number().int().min(0).max(3),
      explanation: z.string(),
    })
  ),
});

export type PracticeQuiz = z.infer<typeof practiceSchema>;
