import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pool } from "@/lib/db/client";
import { generateSimilarQuestions } from "@/lib/llm/similar-question-gen";

export const dynamic = "force-dynamic";

interface MistakeRow {
  id: number;
  user_id: number;
  kp_id: number | null;
  image_url: string | null;
  ocr_text: string | null;
  question_text: string | null;
  student_answer: string | null;
  correct_answer: string | null;
  error_cause: { type: string; description: string } | null;
  solution_approach: unknown;
  related_kp_ids: string[] | null;
  created_at: string | null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const mistakeId = Number(id);
  if (!Number.isInteger(mistakeId) || mistakeId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const userId: number = session.user.id;

  let mistake: MistakeRow | null;
  try {
    const res = await pool.query(
      "SELECT * FROM mistakes WHERE id = $1 AND user_id = $2",
      [mistakeId, userId]
    );
    mistake = (res.rows[0] as MistakeRow | undefined) ?? null;
  } catch (error) {
    console.error("Load mistake failed:", error);
    return NextResponse.json(
      { error: "Failed to load mistake" },
      { status: 500 }
    );
  }

  if (!mistake) {
    return NextResponse.json({ error: "Mistake not found" }, { status: 404 });
  }

  const originalQuestion = (
    mistake.question_text ?? mistake.ocr_text ?? ""
  ).trim();
  if (originalQuestion.length === 0) {
    return NextResponse.json(
      { error: "Mistake has no question text to base similar questions on" },
      { status: 422 }
    );
  }

  try {
    const result = await generateSimilarQuestions({
      originalQuestion,
      errorCause: mistake.error_cause ?? undefined,
      relatedKpIds: mistake.related_kp_ids ?? undefined,
      userId,
      mistakeId: mistake.id,
      kpId: mistake.kp_id ?? undefined,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Similar question generation failed:", error);
    return NextResponse.json(
      { error: "AI 服务暂时不可用" },
      { status: 503 }
    );
  }
}
