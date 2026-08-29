import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pool } from "@/lib/db/client";
import {
  scheduleReview,
  updateMastery,
  getReviewItem,
  Rating,
} from "@/lib/mastery/fsrs-engine";
import type { SimilarQuestions } from "@/lib/prompts/similar-questions";

export const dynamic = "force-dynamic";

type SimilarQuestion = SimilarQuestions["questions"][number];

/**
 * Determine whether the student's answer is correct.
 *
 * The answer may be:
 *   - a number: zero-based index into the question's choices array
 *   - a string: the text of the selected choice
 */
function isCorrectAnswer(question: SimilarQuestion, answer: unknown): boolean {
  if (typeof answer === "number") {
    const choice = question.choices[answer];
    return choice?.isCorrect ?? false;
  }
  if (typeof answer === "string") {
    const choice = question.choices.find((c) => c.text === answer);
    return choice?.isCorrect ?? false;
  }
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // sessionId from the path — accepted but the quizAttemptId in the body
  // is what identifies the quiz to update.
  await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { quizAttemptId, answer, reviewItemId } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (
    typeof quizAttemptId !== "number" ||
    !Number.isInteger(quizAttemptId) ||
    quizAttemptId <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid quizAttemptId" },
      { status: 400 }
    );
  }

  const isValidAnswer =
    (typeof answer === "number" &&
      Number.isInteger(answer) &&
      answer >= 0) ||
    (typeof answer === "string" && answer.length > 0);
  if (!isValidAnswer) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  if (
    typeof reviewItemId !== "number" ||
    !Number.isInteger(reviewItemId) ||
    reviewItemId <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid reviewItemId" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  try {
    // Fetch the quiz attempt, scoped to the current user
    const quizRes = await pool.query(
      `SELECT id, kp_id, quiz_data FROM quiz_attempts
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [quizAttemptId, userId]
    );

    if (quizRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Quiz attempt not found" },
        { status: 404 }
      );
    }

    const quizRow = quizRes.rows[0] as {
      id: number;
      kp_id: number;
      quiz_data: SimilarQuestions;
    };

    const question: SimilarQuestion | undefined =
      quizRow.quiz_data?.questions?.[0];
    if (!question) {
      return NextResponse.json(
        { error: "Quiz data is malformed" },
        { status: 500 }
      );
    }

    const correct = isCorrectAnswer(question, answer);

    // Fetch the review item for this (user, kp) pair
    const reviewItem = await getReviewItem(userId, quizRow.kp_id);
    if (!reviewItem) {
      return NextResponse.json(
        { error: "Review item not found" },
        { status: 404 }
      );
    }

    // Schedule the next review: Good if correct, Again if wrong
    const rating = correct ? Rating.Good : Rating.Again;
    const { updatedItem } = await scheduleReview(reviewItem, rating);

    // Check whether the item has reached mastery
    const masteredItem = await updateMastery(updatedItem);
    const masteryState = masteredItem.state;
    const isMastered = masteryState === "mastered";

    // Record correctness on the quiz attempt
    await pool.query(
      `UPDATE quiz_attempts
       SET correct_count = $1, all_correct = $2
       WHERE id = $3`,
      [correct ? 1 : 0, correct, quizAttemptId]
    );

    return NextResponse.json({
      correct,
      explanation: question.explanation,
      masteryState,
      isMastered,
    });
  } catch (error) {
    console.error("Failed to process answer:", error);
    return NextResponse.json(
      { error: "Failed to process answer" },
      { status: 500 }
    );
  }
}
