import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { analyzeError } from "@/lib/llm/error-analyzer";
import { pool } from "@/lib/db/client";

export const dynamic = "force-dynamic";

interface AnalyzeRequestBody {
  ocrText?: string;
  ocrFormulas?: { latex: string }[];
  studentAnswer?: string;
  userGrade?: number;
  imageUrl?: string;
  kpId?: number;
}

/**
 * Resolve LLM-generated knowledge point identifiers (strings) to
 * knowledge_points.id integers by matching on title.
 */
async function resolveKpIdsByTitle(
  kpIdStrings: string[]
): Promise<number[]> {
  const ids: number[] = [];
  for (const kpIdStr of kpIdStrings) {
    const res = await pool.query(
      "SELECT id FROM knowledge_points WHERE title = $1 LIMIT 1",
      [kpIdStr]
    );
    const row = res.rows[0];
    if (row) {
      ids.push(row.id as number);
    }
  }
  return ids;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AnalyzeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    typeof body.ocrText !== "string" ||
    body.ocrText.trim() === ""
  ) {
    return NextResponse.json(
      { error: "ocrText is required" },
      { status: 400 }
    );
  }

  try {
    const result = await analyzeError({
      ocrText: body.ocrText,
      ocrFormulas: body.ocrFormulas,
      studentAnswer: body.studentAnswer,
      userGrade: body.userGrade ?? session.user.grade ?? undefined,
      userId: session.user.id,
      kpId: body.kpId,
      imageUrl: body.imageUrl,
    });

    if (
      body.kpId != null &&
      result.relatedKpIds.length > 0
    ) {
      const resolvedIds = await resolveKpIdsByTitle(result.relatedKpIds);
      for (const targetId of resolvedIds) {
        if (targetId === body.kpId) continue;
        // Bidirectional: A→B and B→A
        await pool.query(
          `INSERT INTO knowledge_associations (kp_id_1, kp_id_2, association_type)
           VALUES ($1, $2, 'related')
           ON CONFLICT DO NOTHING`,
          [body.kpId, targetId]
        );
        await pool.query(
          `INSERT INTO knowledge_associations (kp_id_1, kp_id_2, association_type)
           VALUES ($1, $2, 'related')
           ON CONFLICT DO NOTHING`,
          [targetId, body.kpId]
        );
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error analysis failed:", error);
    return NextResponse.json(
      { error: "AI 服务暂时不可用，请稍后重试" },
      { status: 503 }
    );
  }
}
