import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth/session";
import { pool } from "@/lib/db/client";
import { getDueItems } from "@/lib/mastery/fsrs-engine";
import type { SimilarQuestions } from "@/lib/prompts/similar-questions";

export const dynamic = "force-dynamic";

interface SessionItem {
  kpId: number;
  reviewItemId: number;
  quizAttemptId: number;
  question: string;
  choices: { text: string; isCorrect: boolean }[];
  explanation: string;
  targetsKp: string;
}

interface MistakeRow {
  question_text: string | null;
  ocr_text: string | null;
  error_cause: { type: string; description: string } | null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const dueItems = await getDueItems(userId);

    const items: SessionItem[] = [];
    for (const dueItem of dueItems) {
      // Reuse an unanswered similar-question quiz if one exists for this KP
      const existingRes = await pool.query(
        `SELECT id, quiz_data FROM quiz_attempts
         WHERE user_id = $1 AND kp_id = $2
           AND all_correct IS NULL AND generated_from = 'similar'
         ORDER BY created_at DESC LIMIT 1`,
        [userId, dueItem.kpId]
      );

      let quizAttemptId: number;
      let quizData: SimilarQuestions;

      if (existingRes.rows.length > 0) {
        quizAttemptId = existingRes.rows[0].id;
        quizData = existingRes.rows[0].quiz_data as SimilarQuestions;
      } else {
        // generateSimilarQuestions requires an original question from a
        // mistake. Look up the user's most recent mistake for this KP.
        const mistakeRes = await pool.query(
          `SELECT question_text, ocr_text, error_cause FROM mistakes
           WHERE user_id = $1 AND kp_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [userId, dueItem.kpId]
        );
        if (mistakeRes.rows.length === 0) continue;

        const mistake = mistakeRes.rows[0] as MistakeRow;
        const originalQuestion = mistake.question_text ?? mistake.ocr_text;
        if (!originalQuestion) continue;

        // Dynamically import the similar-question generator (T15 module).
        // If the module or generation call fails, skip this due item.
        let generated: SimilarQuestions | undefined;
        try {
          const mod = await import("@/lib/llm/similar-question-gen");
          generated = await mod.generateSimilarQuestions({
            originalQuestion,
            userId,
            kpId: dueItem.kpId,
            errorCause: mistake.error_cause ?? undefined,
          });
        } catch {
          continue;
        }
        if (!generated) continue;

        // T15 inserts into quiz_attempts with review_item_id = NULL and
        // all_correct = false (column default). Fix up the inserted row:
        // link it to the review item and mark as unanswered (all_correct = NULL).
        const updateRes = await pool.query(
          `UPDATE quiz_attempts
           SET review_item_id = $1, all_correct = NULL
           WHERE id = (
             SELECT id FROM quiz_attempts
             WHERE user_id = $2 AND kp_id = $3
               AND generated_from = 'similar'
             ORDER BY created_at DESC LIMIT 1
           )
           RETURNING id`,
          [dueItem.id, userId, dueItem.kpId]
        );
        if (updateRes.rows.length === 0) continue;

        quizAttemptId = updateRes.rows[0].id;
        quizData = generated;
      }

      // Extract the first question for the session item
      if (!quizData.questions || quizData.questions.length === 0) continue;
      const firstQuestion = quizData.questions[0];

      items.push({
        kpId: dueItem.kpId,
        reviewItemId: dueItem.id,
        quizAttemptId,
        question: firstQuestion.question,
        choices: firstQuestion.choices,
        explanation: firstQuestion.explanation,
        targetsKp: firstQuestion.targetsKp,
      });
    }

    return NextResponse.json({
      sessionId: randomUUID(),
      items,
    });
  } catch (error) {
    console.error("Failed to build review session:", error);
    return NextResponse.json(
      { error: "Failed to build review session" },
      { status: 500 }
    );
  }
}
