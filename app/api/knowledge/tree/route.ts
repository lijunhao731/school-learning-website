import { NextResponse } from "next/server";
import { pool } from "@/lib/db/client";
import type { KnowledgePoint } from "@/lib/db/knowledge-queries";
import type { KnowledgeTreeNode } from "@/lib/db/knowledge-queries";

export const dynamic = "force-dynamic";

function buildTreeFromNodes(nodes: KnowledgePoint[]): KnowledgeTreeNode[] {
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

export async function GET() {
  try {
    // 获取所有数学知识点，按 ltree_path 排序保证树结构顺序
    const result = await pool.query(
      "SELECT * FROM knowledge_points WHERE subject = 'math' ORDER BY ltree_path::ltree"
    );
    const nodes = result.rows as KnowledgePoint[];

    if (nodes.length === 0) {
      return NextResponse.json({ trees: [] });
    }

    const trees = buildTreeFromNodes(nodes);
    return NextResponse.json({ trees });
  } catch {
    return NextResponse.json(
      { error: "加载知识树失败，请稍后重试" },
      { status: 500 }
    );
  }
}
