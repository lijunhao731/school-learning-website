import { z } from "zod";

export const systemPrompt = `你是一位经验丰富的中小学数学老师。你用清晰、准确的语言讲解知识点，使用适合学生年级的表达方式。语言简洁、准确、符合教学规律。所有内容必须用中文呈现。`;

/** 一次性生成知识点的全部教学内容（核心概念+详细讲解+例题） */
export const allContentSchema = z.object({
  intro: z.string().describe("核心概念：3-5句话介绍定义和核心思想，含关键公式，不含例题"),
  detail: z.string().describe("详细讲解：方法步骤、关键技巧、常见错误，不含例题"),
  examples: z.array(
    z.object({
      question: z.string().describe("题目"),
      solution: z.string().describe("完整分步解答"),
      explanation: z.string().describe("每一步的解释说明"),
      difficulty: z.enum(["easy", "medium", "hard"]).describe("难度"),
    })
  ).describe("3道例题：简单、中等、较难各一道"),
});

export type AllContent = z.infer<typeof allContentSchema>;

export function buildAllContentPrompt(kpTitle: string, grade: string): string {
  return `知识点：${kpTitle}
年级：${grade}

请生成这个知识点的全部教学内容，严格按照以下JSON格式返回，不要包含任何其他文字：

{
  "intro": "核心概念：3-5句话介绍定义和核心思想，含关键公式，不含例题",
  "detail": "详细讲解：方法步骤、关键技巧、常见错误，不含例题",
  "examples": [
    {
      "question": "题目内容",
      "solution": "完整分步解答过程",
      "explanation": "每一步的解释说明",
      "difficulty": "easy"
    },
    {
      "question": "题目内容",
      "solution": "完整分步解答过程",
      "explanation": "每一步的解释说明",
      "difficulty": "medium"
    },
    {
      "question": "题目内容",
      "solution": "完整分步解答过程",
      "explanation": "每一步的解释说明",
      "difficulty": "hard"
    }
  ]
}

要求：
- intro 和 detail 用中文，数学公式用文字描述
- examples 提供3道例题，difficulty 分别为 easy、medium、hard
- 只返回JSON，不要有markdown代码块标记，不要有其他说明文字`;
}
