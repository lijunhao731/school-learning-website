import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pool } from "@/lib/db/client";

export const dynamic = "force-dynamic";

interface MistakeRow {
  id: number;
  kp_id: number | null;
  image_url: string | null;
  error_cause: { type: string; description: string } | null;
  created_at: string | null;
}

interface StateCountRow {
  state: string | null;
  count: string;
}

const ALL_STATES = ["new", "learning", "review", "relearning", "mastered"] as const;
type MasteryState = (typeof ALL_STATES)[number];

function buildMasteryStats(rows: StateCountRow[]): Record<MasteryState, number> {
  const stats: Record<MasteryState, number> = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
    mastered: 0,
  };
  for (const row of rows) {
    const state = (row.state ?? "new") as MasteryState;
    if (ALL_STATES.includes(state)) {
      stats[state] += Number(row.count) || 0;
    }
  }
  return stats;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId: number = session.user.id;

  try {
    const [dueRes, stateRes, mistakesRes, kpsRes] = await Promise.all([
      // 今日待复习数
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM review_items
         WHERE user_id = $1 AND due_date <= NOW() AND state != 'mastered'`,
        [userId]
      ),
      // 掌握状态分布
      pool.query<StateCountRow>(
        `SELECT state, COUNT(*)::text AS count
         FROM review_items
         WHERE user_id = $1 GROUP BY state`,
        [userId]
      ),
      // 最近5条错题
      pool.query<MistakeRow>(
        `SELECT m.id, m.kp_id, m.image_url, m.error_cause, m.created_at
         FROM mistakes m
         WHERE m.user_id = $1
         ORDER BY m.created_at DESC
         LIMIT 5`,
        [userId]
      ),
      // 总知识点数
      pool.query(
        `SELECT COUNT(*)::int AS count FROM knowledge_points`,
        []
      ),
    ]);

    const dueCount: number =
      (dueRes.rows[0] as { count: number } | undefined)?.count ?? 0;
    const masteryStats = buildMasteryStats(stateRes.rows);
    const totalKps: number =
      (kpsRes.rows[0] as { count: number } | undefined)?.count ?? 0;

    const recentMistakes = (mistakesRes.rows as MistakeRow[]).map((row) => ({
      id: row.id,
      kpId: row.kp_id,
      imageUrl: row.image_url,
      errorCause: row.error_cause,
      createdAt: row.created_at ?? "",
    }));

    return NextResponse.json({
      dueCount,
      masteryStats,
      recentMistakes,
      totalKps,
    });
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
