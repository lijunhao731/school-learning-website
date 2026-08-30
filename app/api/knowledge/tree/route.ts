import { NextResponse } from "next/server";
import { pool } from "@/lib/db/client";
import type { KnowledgePoint } from "@/lib/db/knowledge-queries";
import type { KnowledgeTreeNode } from "@/lib/db/knowledge-queries";

export const dynamic = "force-dynamic";

/**
 * KnowledgePoint raw row from DB.
 * grade_level: null=domain root, number=module or leaf (1-5 小学, 6-9 初中, 10-12 高中)
 * chapter: original unit name (e.g. "二、小数乘除法")
 * title: display title (domain name / cleaned module name / KP name)
 */
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

function gradeLabel(gradeLevel: number): string {
  if (gradeLevel <= 5) return `小学${gradeLevel}年级`;
  if (gradeLevel <= 9) return `初中${gradeLevel - 5}年级`;
  return `高中${gradeLevel - 9}年级`;
}

/**
 * Build grade-based tree: grade root -> domain -> module -> KP
 * Groups all modules+KPs by their grade_level, then nests under domain.
 */
function buildGradeTree(nodes: RawKP[]): KnowledgeTreeNode[] {
  // Collect all modules (have grade_level and parent_id pointing to domain root)
  // and all KPs (have grade_level and parent_id pointing to module)
  const nodeMap = new Map<number, RawKP>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Group by grade
  const gradeMap = new Map<number, {
    domains: Map<number, { domainNode: RawKP; modules: RawKP[] }>
  }>();

  for (const n of nodes) {
    // Modules: parent is a domain root (parent_id's parent_id is null)
    const parent = n.parent_id != null ? nodeMap.get(n.parent_id) : null;
    const grandparent = parent?.parent_id != null ? nodeMap.get(parent.parent_id) : null;

    if (parent && grandparent === null && n.grade_level != null) {
      // This is a module under a domain
      const g = n.grade_level;
      if (!gradeMap.has(g)) gradeMap.set(g, { domains: new Map() });
      const gd = gradeMap.get(g)!;
      if (!gd.domains.has(parent.id)) {
        gd.domains.set(parent.id, { domainNode: parent, modules: [] });
      }
      gd.domains.get(parent.id)!.modules.push(n);
    }
  }

  // Sort grades
  const sortedGrades = [...gradeMap.keys()].sort((a, b) => a - b);

  const roots: KnowledgeTreeNode[] = [];
  let fakeId = 900000; // virtual grade root IDs

  for (const g of sortedGrades) {
    const gd = gradeMap.get(g)!;
    const gradeRoot: KnowledgeTreeNode = {
      id: fakeId++,
      subject: "math",
      grade_level: g,
      chapter: null,
      title: gradeLabel(g),
      ltree_path: null,
      parent_id: null,
      created_at: null,
      children: [],
    };

    for (const [, { domainNode, modules }] of gd.domains) {
      const domainNode_virtual: KnowledgeTreeNode = {
        ...domainNode,
        children: [],
      };
      for (const mod of modules) {
        const moduleNode: KnowledgeTreeNode = {
          ...mod,
          // Use chapter (original unit name) as display title for grade view
          title: mod.chapter || mod.title,
          children: [],
        };
        // Find KPs under this module
        const kps = nodes.filter(
          (n) => n.parent_id === mod.id
        );
        for (const kp of kps) {
          moduleNode.children.push({ ...kp, children: [] });
        }
        domainNode_virtual.children.push(moduleNode);
      }
      gradeRoot.children.push(domainNode_virtual);
    }

    roots.push(gradeRoot);
  }

  return roots;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "logical";

    const result = await pool.query(
      "SELECT * FROM knowledge_points WHERE subject = 'math' ORDER BY ltree_path::ltree"
    );
    const nodes = result.rows as RawKP[];

    if (nodes.length === 0) {
      return NextResponse.json({ trees: [] });
    }

    const trees = mode === "grade"
      ? buildGradeTree(nodes)
      : buildTreeFromNodes(nodes);

    return NextResponse.json({ trees, mode });
  } catch {
    return NextResponse.json(
      { error: "加载知识树失败，请稍后重试" },
      { status: 500 }
    );
  }
}
