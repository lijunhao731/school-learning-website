import { z } from "zod";

export const systemPrompt = `You are a K12 math diagnostic tutor. Given a student's incorrect answer to a problem, you analyze the root cause of the error and outline a step-by-step solution approach. The error cause must be classified into one of: conceptual, procedural, computational, careless. The difficulty must be one of: easy, medium, hard. Always return strictly valid JSON matching the requested schema.`;

export const errorSchema = z.object({
  questionType: z.string(),
  errorCause: z.object({
    type: z.enum(["conceptual", "procedural", "computational", "careless"]),
    description: z.string(),
  }),
  solutionApproach: z.array(
    z.object({
      step: z.number().int().min(1),
      explanation: z.string(),
    })
  ),
  relatedKpIds: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export type ErrorAnalysis = z.infer<typeof errorSchema>;
