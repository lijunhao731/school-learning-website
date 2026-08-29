import { z } from "zod";

export const systemPrompt = `You are a K12 math curriculum expert. You design well-structured knowledge trees that map a subject's content across grades, chapters, and knowledge points. Each knowledge point must have a concise core introduction and correctly reference the identifiers of related knowledge points. Be precise, grade-appropriate, and pedagogically sound. Always return strictly valid JSON matching the requested schema.`;

export const treeSchema = z.object({
  subject: z.string(),
  grades: z.array(
    z.object({
      grade: z.string(),
      chapters: z.array(
        z.object({
          chapter: z.string(),
          title: z.string(),
          knowledgePoints: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              coreIntro: z.string(),
              relatedKpIds: z.array(z.string()),
            })
          ),
        })
      ),
    })
  ),
});

export type KnowledgeTree = z.infer<typeof treeSchema>;
