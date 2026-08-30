import { generateStructured } from "@/lib/llm/generate";
import { systemPrompt, treeSchema } from "@/lib/prompts/knowledge-tree-gen";
import type { KnowledgeTree } from "@/lib/prompts/knowledge-tree-gen";
import { createKP, getTree } from "@/lib/db/knowledge-queries";
import type { KnowledgeTreeNode } from "@/lib/db/knowledge-queries";
import { pool } from "@/lib/db/client";

export async function generateMathTree(
  grades: number[]
): Promise<KnowledgeTreeNode[]> {
  const existing = await getTree("math", grades[0]);
  if (existing) {
    const trees = await Promise.all(grades.map((g) => getTree("math", g)));
    return trees.filter((t): t is KnowledgeTreeNode => t !== null);
  }

  const userPrompt = `请为中国中小学数学年级 ${grades.join(", ")} 生成知识点树。包含每个年级的章节和知识点。所有内容用中文呈现。`;
  const tree = await generateStructured<KnowledgeTree>(
    systemPrompt,
    userPrompt,
    treeSchema
  );

  await saveTreeToDB(tree);

  const trees = await Promise.all(grades.map((g) => getTree("math", g)));
  return trees.filter((t): t is KnowledgeTreeNode => t !== null);
}

async function saveTreeToDB(tree: KnowledgeTree): Promise<void> {
  const subject = tree.subject || "math";
  const idMap = new Map<string, number>();
  const edges: { from: string; to: string }[] = [];

  for (const gradeNode of tree.grades) {
    const gradeNum = parseGrade(gradeNode.grade);

    const gradeRoot = await createKP({
      subject,
      grade_level: gradeNum,
      chapter: null,
      title: `${gradeNum}年级数学`,
    });

    for (const chapterNode of gradeNode.chapters) {
      const chapterKP = await createKP({
        subject,
        grade_level: gradeNum,
        chapter: chapterNode.chapter,
        title: chapterNode.title,
        parent_id: gradeRoot.id,
      });

      for (const kp of chapterNode.knowledgePoints) {
        const dbKP = await createKP({
          subject,
          grade_level: gradeNum,
          chapter: chapterNode.chapter,
          title: kp.title,
          parent_id: chapterKP.id,
        });

        idMap.set(kp.id, dbKP.id);

        for (const relatedId of kp.relatedKpIds) {
          edges.push({ from: kp.id, to: relatedId });
        }
      }
    }
  }

  const seen = new Set<string>();
  for (const edge of edges) {
    const fromId = idMap.get(edge.from);
    const toId = idMap.get(edge.to);
    if (fromId == null || toId == null || fromId === toId) continue;
    const key = fromId < toId ? `${fromId}-${toId}` : `${toId}-${fromId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await pool.query(
      "INSERT INTO knowledge_associations (kp_id_1, kp_id_2, association_type) VALUES ($1, $2, 'related')",
      [fromId, toId]
    );
  }
}

function parseGrade(grade: string): number {
  const match = grade.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}
