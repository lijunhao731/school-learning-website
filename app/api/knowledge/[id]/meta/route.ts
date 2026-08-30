import { NextResponse } from "next/server";
import { pool } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();

  const { id } = await params;
  const kpId = parseInt(id, 10);
  if (!Number.isInteger(kpId) || kpId <= 0) {
    return NextResponse.json({ error: "无效的知识点 ID" }, { status: 400 });
  }

  // 查询知识点本身 + 祖先链（大类 > 小类 > 知识点）
  const result = await pool.query(
    `WITH RECURSIVE ancestors AS (
      SELECT id, title, chapter, grade_level, parent_id, created_at, 0 AS depth
      FROM knowledge_points
      WHERE id = $1
      UNION ALL
      SELECT kp.id, kp.title, kp.chapter, kp.grade_level, kp.parent_id, kp.created_at, a.depth + 1
      FROM knowledge_points kp
      JOIN ancestors a ON kp.id = a.parent_id
    )
    SELECT id, title, chapter, grade_level, created_at, depth
    FROM ancestors
    ORDER BY depth DESC`,
    [kpId]
  );

  if (!result.rows || result.rows.length === 0) {
    return NextResponse.json({ error: "知识点不存在" }, { status: 404 });
  }

  const rows = result.rows as Array<{
    id: number;
    title: string;
    chapter: string | null;
    grade_level: number | null;
    created_at: string | null;
    depth: number;
  }>;

  // depth DESC means: first row = root (大类), last = the KP itself
  const kp = rows[rows.length - 1];
  const category = rows[0]?.title ?? "";       // 大类
  const subcategory = rows.length >= 2 ? rows[1].title : "";  // 小类
  const breadcrumb = rows.map((r) => r.title);

  function gradeLabel(g: number | null): string {
    if (g == null) return "";
    if (g <= 5) return `小学${g}年级`;
    if (g <= 9) return `初中${g - 5}年级`;
    return `高中${g - 9}年级`;
  }

  function formatDate(d: string | null): string {
    if (!d) return "";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  return NextResponse.json({
    id: kp.id,
    title: kp.title,
    category,
    subcategory,
    breadcrumb,
    gradeLevel: kp.grade_level,
    gradeLabel: gradeLabel(kp.grade_level),
    chapter: kp.chapter ?? "",
    createdAt: kp.created_at,
    createdAtLabel: formatDate(kp.created_at),
  });
}
