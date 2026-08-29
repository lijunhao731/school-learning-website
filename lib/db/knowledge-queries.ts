import { pool } from "./client";

export interface KnowledgePoint {
  id: number;
  subject: string | null;
  grade_level: number | null;
  chapter: string | null;
  title: string;
  ltree_path: string | null;
  parent_id: number | null;
  created_at: Date | null;
}

export interface KnowledgeTreeNode extends KnowledgePoint {
  children: KnowledgeTreeNode[];
}

export interface ContentCacheEntry {
  id: number;
  kp_id: number;
  content_type: string | null;
  content: unknown;
  created_at: Date | null;
  expires_at: Date | null;
}

export interface CreateKPInput {
  subject: string;
  grade_level: number;
  chapter: string | null;
  title: string;
  parent_id?: number | null;
}

function buildTree(nodes: KnowledgePoint[]): KnowledgeTreeNode | null {
  if (nodes.length === 0) return null;

  const nodeMap = new Map<number, KnowledgeTreeNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  let root: KnowledgeTreeNode | null = null;
  let first: KnowledgeTreeNode | null = null;
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (first === null) first = treeNode;
    if (node.parent_id === null) {
      root = treeNode;
    } else {
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children.push(treeNode);
      }
    }
  }

  if (root === null) root = first;
  return root;
}

export async function getTree(
  subject: string,
  grade: number
): Promise<KnowledgeTreeNode | null> {
  const rootRes = await pool.query(
    "SELECT * FROM knowledge_points WHERE subject = $1 AND grade_level = $2 AND parent_id IS NULL ORDER BY id LIMIT 1",
    [subject, grade]
  );
  const root = rootRes.rows[0] as KnowledgePoint | undefined;
  if (!root || !root.ltree_path) return null;

  const descendantsRes = await pool.query(
    "SELECT * FROM knowledge_points WHERE subject = $1 AND grade_level = $2 AND ltree_path::ltree <@ $3::ltree ORDER BY ltree_path",
    [subject, grade, root.ltree_path]
  );
  const nodes = descendantsRes.rows as KnowledgePoint[];
  return buildTree(nodes);
}

export async function getKnowledgePoint(
  id: number
): Promise<KnowledgePoint | null> {
  const res = await pool.query(
    "SELECT * FROM knowledge_points WHERE id = $1",
    [id]
  );
  return (res.rows[0] as KnowledgePoint | undefined) ?? null;
}

export async function getChildren(
  parentId: number
): Promise<KnowledgePoint[]> {
  const res = await pool.query(
    "SELECT * FROM knowledge_points WHERE parent_id = $1 ORDER BY created_at",
    [parentId]
  );
  return res.rows as KnowledgePoint[];
}

export async function getAncestors(id: number): Promise<KnowledgePoint[]> {
  const res = await pool.query(
    "SELECT * FROM knowledge_points WHERE ltree_path::ltree @> (SELECT ltree_path::ltree FROM knowledge_points WHERE id = $1) AND id != $1 ORDER BY ltree_path",
    [id]
  );
  return res.rows as KnowledgePoint[];
}

export async function createKP(data: CreateKPInput): Promise<KnowledgePoint> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertRes = await client.query(
      "INSERT INTO knowledge_points (subject, grade_level, chapter, title, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [
        data.subject,
        data.grade_level,
        data.chapter,
        data.title,
        data.parent_id ?? null,
      ]
    );
    const newId: number = insertRes.rows[0].id;

    let ltreePath: string;
    if (data.parent_id != null) {
      const parentRes = await client.query(
        "SELECT ltree_path FROM knowledge_points WHERE id = $1",
        [data.parent_id]
      );
      const parentPath = (parentRes.rows[0]?.ltree_path as string | null) ?? null;
      ltreePath = parentPath ? `${parentPath}.${newId}` : String(newId);
    } else {
      ltreePath = String(newId);
    }

    await client.query(
      "UPDATE knowledge_points SET ltree_path = $1 WHERE id = $2",
      [ltreePath, newId]
    );

    const finalRes = await client.query(
      "SELECT * FROM knowledge_points WHERE id = $1",
      [newId]
    );

    await client.query("COMMIT");
    return finalRes.rows[0] as KnowledgePoint;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRelatedKPs(kpId: number): Promise<KnowledgePoint[]> {
  const res = await pool.query(
    `SELECT kp.* FROM knowledge_points kp
     JOIN knowledge_associations ka
       ON (ka.kp_id_1 = kp.id AND ka.kp_id_2 = $1)
       OR (ka.kp_id_2 = kp.id AND ka.kp_id_1 = $1)
     WHERE kp.id != $1`,
    [kpId]
  );
  return res.rows as KnowledgePoint[];
}

export async function cacheContent(
  kpId: number,
  contentType: string,
  content: any
): Promise<void> {
  await pool.query(
    "INSERT INTO content_cache (kp_id, content_type, content, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')",
    [kpId, contentType, content]
  );
}

export async function getCachedContent(
  kpId: number,
  contentType: string
): Promise<unknown | null> {
  const res = await pool.query(
    "SELECT * FROM content_cache WHERE kp_id = $1 AND content_type = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
    [kpId, contentType]
  );
  const row = res.rows[0] as ContentCacheEntry | undefined;
  return row ? row.content : null;
}
