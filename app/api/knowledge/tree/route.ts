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
 */
function filterTreeByGrade(
  trees: KnowledgeTreeNode[],
  filter: { stage?: string; grade?: number }
): KnowledgeTreeNode[] {
  function leafMatches(node: KnowledgeTreeNode): boolean {
    if (node.grade_level != null) {
      if (filter.grade != null) return node.grade_level === filter.grade;
      if (filter.stage === "小学") return node.grade_level <= 5;
      if (filter.stage === "初中") return node.grade_level >= 6 && node.grade_level <= 9;
      if (filter.stage === "高中") return node.grade_level >= 10;
      return true;
    }
    return node.children.some((c) => leafMatches(c));
  }

  function prune(node: KnowledgeTreeNode): KnowledgeTreeNode | null {
    if (node.grade_level != null) return node; // leaf
    const kept = node.children
      .map((c) => prune(c))
      .filter((c): c is KnowledgeTreeNode => c !== null);
    if (kept.length === 0) return null;
    return { ...node, children: kept };
  }

  return trees
    .filter(leafMatches)
    .map(prune)
    .filter((n): n is KnowledgeTreeNode => n !== null);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage") || undefined;
    const gradeParam = searchParams.get("grade");
    const grade = gradeParam ? parseInt(gradeParam, 10) : undefined;

    const result = await pool.query(
      "SELECT * FROM knowledge_points WHERE subject = 'math' ORDER BY ltree_path::ltree"
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
