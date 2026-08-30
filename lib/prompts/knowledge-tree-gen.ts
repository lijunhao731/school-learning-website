import { z } from "zod";

export const systemPrompt = `你是一位中小学数学课程专家。你设计结构清晰的知识树，映射各年级、各章节的知识点。每个知识点必须有简洁的核心介绍，并正确引用相关知识点的标识符。内容精确、适合年级水平、符合教学规律。所有内容必须用中文呈现。始终返回严格有效的 JSON，符合要求的结构。`;

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
