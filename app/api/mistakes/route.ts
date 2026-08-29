import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pool } from "@/lib/db/client";

export const dynamic = "force-dynamic";

interface MistakeListRow {
  id: number;
  kp_id: number | null;
  image_url: string | null;
  ocr_text: string | null;
  question_text: string | null;
  student_answer: string | null;
  error_cause: { type: string; description: string } | null;
  solution_approach: unknown;
  related_kp_ids: string[] | null;
  created_at: string | null;
  mastery_state: string | null;
  kp_title: string | null;
}

function parseIntParam(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseStatusParam(value: string | null): string | null {
  const allowed = new Set([
    "new",
    "learning",
    "review",
    "relearning",
    "mastered",
  ]);
  if (value === null || value.trim() === "") return null;
  const v = value.trim();
  return allowed.has(v) ? v : null;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = parseIntParam(url.searchParams.get("page")) ?? 1;
  const limitRaw = parseIntParam(url.searchParams.get("limit")) ?? 10;
  const limit = Math.min(limitRaw, 100);
  const kpId = parseIntParam(url.searchParams.get("kpId"));
  const status = parseStatusParam(url.searchParams.get("status"));

  const userId: number = session.user.id;
  const offset = (page - 1) * limit;

  try {
    const rowsRes = await pool.query(
      `SELECT m.id, m.kp_id, m.image_url, m.ocr_text, m.question_text,
              m.student_answer, m.error_cause, m.solution_approach,
              m.related_kp_ids, m.created_at,
              ri.state AS mastery_state,
              k.title AS kp_title
       FROM mistakes m
       LEFT JOIN review_items ri
         ON ri.user_id = m.user_id AND ri.kp_id = m.kp_id
       LEFT JOIN knowledge_points k ON k.id = m.kp_id
       WHERE m.user_id = $1
         AND ($2::int IS NULL OR m.kp_id = $2)
         AND ($3::text IS NULL OR ri.state = $3)
       ORDER BY m.created_at DESC
       LIMIT $4 OFFSET $5`,
      [userId, kpId, status, limit, offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM mistakes m
       LEFT JOIN review_items ri
         ON ri.user_id = m.user_id AND ri.kp_id = m.kp_id
       WHERE m.user_id = $1
         AND ($2::int IS NULL OR m.kp_id = $2)
         AND ($3::text IS NULL OR ri.state = $3)`,
      [userId, kpId, status]
    );

    const items = rowsRes.rows as MistakeListRow[];
    const total: number =
      (countRes.rows[0] as { total: number } | undefined)?.total ?? 0;
    const hasMore = offset + items.length < total;

    return NextResponse.json({ items, total, hasMore });
  } catch (error) {
    console.error("Failed to list mistakes:", error);
    return NextResponse.json(
      { error: "Failed to load mistakes" },
      { status: 500 }
    );
  }
}
