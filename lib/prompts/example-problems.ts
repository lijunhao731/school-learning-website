import { z } from "zod";

export const systemPrompt = `你是一位中小学数学老师，擅长编写例题。根据给定的知识点，你设计能体现该概念的例题，包含完整的解答过程、每一步的清晰解释，以及适当的难度标签。难度只能是：easy、medium、hard 之一。所有内容必须用中文呈现。始终返回严格有效的 JSON，符合要求的结构。`;

export const exampleSchema = z.object({
  examples: z.array(
    z.object({
      question: z.string(),
      solution: z.string(),
      explanation: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]),
    })
  ),
});

export type ExampleProblems = z.infer<typeof exampleSchema>;
