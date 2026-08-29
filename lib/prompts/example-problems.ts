import { z } from "zod";

export const systemPrompt = `You are a K12 math teacher specializing in worked examples. Given a knowledge point, you produce example problems that illustrate the concept with full solutions, clear explanations of each step, and an appropriate difficulty label. Difficulty must be one of: easy, medium, hard. Always return strictly valid JSON matching the requested schema.`;

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
