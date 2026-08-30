import { NextResponse } from "next/server";
import { pool } from "@/lib/db/client";
import type { KnowledgePoint } from "@/lib/db/knowledge-queries";
import type { KnowledgeTreeNode } from "@/lib/db/knowledge-queries";

export const dynamic = "force-dynamic";

interface RawKP extends KnowledgePoint {}

function buildTreeFromNodes(nodes: RawKP[]): KnowledgeTreeNode[] {
  const nodeMap = new Map<number, KnowledgeTreeNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  const roots: KnowledgeTreeNode[] = [];
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parent_id === null) {
      roots.push(treeNode);
    } else {
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children.push(treeNode);
      }
    }
  }
  return roots;
}

/**
 * Prune tree: keep only branches that have leaf nodes matching the grade filter.
 * Non-leaf nodes with grade_level are also checked (e.g. module-level grade).
 */
function filterTreeByGrade(
  trees: KnowledgeTreeNode[],
  filter: { stage?: string; grade?: number }
): KnowledgeTreeNode[] {
  function gradeMatches(gradeLevel: number): boolean {
    if (filter.grade != null) return gradeLevel === filter.grade;
    if (filter.stage === "小学") return gradeLevel <= 5;
    if (filter.stage === "初中") return gradeLevel >= 6 && gradeLevel <= 9;
    if (filter.stage === "高中") return gradeLevel >= 10;
    return true;
  }

  function nodeMatches(node: KnowledgeTreeNode): boolean {
    // Leaf or grade-tagged node: check directly
    if (node.grade_level != null && node.children.length === 0) {
      return gradeMatches(node.grade_level);
    }
    // Non-leaf: keep if any descendant matches
    if (node.children.length === 0) return false;
    return node.children.some((c) => nodeMatches(c));
  }

  function prune(node: KnowledgeTreeNode): KnowledgeTreeNode | null {
    // Leaf with grade: only keep if grade matches
    if (node.children.length === 0) {
      if (node.grade_level != null && !gradeMatches(node.grade_level)) return null;
      return node;
    }
    // Non-leaf: prune children, keep if any survive
    const kept = node.children
      .map((c) => prune(c))
      .filter((c): c is KnowledgeTreeNode => c !== null);
    if (kept.length === 0) return null;
    return { ...node, children: kept };
  }

  return trees
    .filter(nodeMatches)
    .map(prune)
    .filter((n): n is KnowledgeTreeNode => n !== null);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject") || "math";
    const stage = searchParams.get("stage") || undefined;
    const gradeParam = searchParams.get("grade");
    const grade = gradeParam ? parseInt(gradeParam, 10) : undefined;

    const result = await pool.query(
      "SELECT * FROM knowledge_points WHERE subject = $1 ORDER BY ltree_path::ltree",
      [subject]
    );
    const nodes = result.rows as RawKP[];

    if (nodes.length === 0) {
      return NextResponse.json({ trees: [] });
    }

    let trees = buildTreeFromNodes(nodes);

    if (stage || grade != null) {
      trees = filterTreeByGrade(trees, { stage, grade });
    }

    return NextResponse.json({ trees });
  } catch {
    return NextResponse.json(
      { error: "加载知识树失败，请稍后重试" },
      { status: 500 }
    );
  }
}
