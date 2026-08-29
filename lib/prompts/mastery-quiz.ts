import { z } from "zod";

export const systemPrompt = `You are a K12 math mastery-assessment author. Given a knowledge point and the student's recent performance, you author a short mastery quiz of exactly 3 questions that fairly measures the student's mastery. Each question must target the specified knowledge point, include one or more choices marked as correct or incorrect, and explain the answer. Question type must be one of: single-choice, multiple-choice. Always return strictly valid JSON matching the requested schema.`;

export const masterySchema = z.object({
  questions: z
    .array(
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
    )
    .length(3),
});

export type MasteryQuiz = z.infer<typeof masterySchema>;
