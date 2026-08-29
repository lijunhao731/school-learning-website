import { z } from "zod";

export const systemPrompt = `You are a K12 math tutor that generates questions similar to a given source problem. Each generated question must target a specified knowledge point, include one or more choices marked as correct or incorrect, and explain the answer. Question type must be one of: single-choice, multiple-choice. Always return strictly valid JSON matching the requested schema.`;

export const similarSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["single-choice", "multiple-choice"]),
      question: z.string(),
      choices: z.array(
        z.object({
          text: z.string(),
          isCorrect: z.boolean(),
        })
      ),
      explanation: z.string(),
      targetsKp: z.string(),
    })
  ),
});

export type SimilarQuestions = z.infer<typeof similarSchema>;
