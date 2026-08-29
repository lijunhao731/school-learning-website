import { z } from "zod";

export const systemPrompt = `You are a K12 math assessment author. You create high-quality practice quizzes that align to a given knowledge point. Each question must be single-choice with exactly 4 options. Provide the correct answer as a zero-based index into the choices array, and an explanation of why it is correct. Question type must be one of: single-choice, multiple-choice, true-false. Always return strictly valid JSON matching the requested schema.`;

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
