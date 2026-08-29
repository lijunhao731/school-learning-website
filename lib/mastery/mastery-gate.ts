import { generateStructured } from "@/lib/llm/generate";
import {
  systemPrompt,
  masterySchema,
  type MasteryQuiz,
} from "@/lib/prompts/mastery-quiz";
import { pool } from "@/lib/db/client";
import { getReviewItem, type ReviewItem } from "@/lib/mastery/fsrs-engine";

/**
 * Check whether the mastery gate should be triggered for this (user, kp) pair.
 *
 * The gate fires when the student has answered correctly at least twice in a
 * row and has completed at least two reviews, without already being mastered.
 */
export async function shouldTriggerGate(
  userId: number,
  kpId: number
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM review_items
     WHERE user_id = $1 AND kp_id = $2
       AND consecutive_correct >= 2 AND reps >= 2
       AND state != 'mastered'
     LIMIT 1`,
    [userId, kpId]
  );
  return res.rows.length > 0;
}

/**
 * Generate a 3-question mastery confirmation quiz via the LLM.
 *
 * Returns null when the gate conditions are not met or the knowledge point
 * does not exist.
 */
export async function generateMasteryQuiz(
  userId: number,
  kpId: number
): Promise<{ quizAttemptId: number; quiz: MasteryQuiz } | null> {
  const triggered = await shouldTriggerGate(userId, kpId);
  if (!triggered) {
    return null;
  }

  const kpRes = await pool.query(
    "SELECT title FROM knowledge_points WHERE id = $1",
    [kpId]
  );
  const kpRow = kpRes.rows[0] as { title: string } | undefined;
  if (!kpRow) {
    return null;
  }

  const reviewItem: ReviewItem | null = await getReviewItem(userId, kpId);
  const recentPerformance = reviewItem
    ? `${reviewItem.reps} total reviews, ${reviewItem.consecutiveCorrect} consecutive correct answers, current state: ${reviewItem.state}.`
    : "Limited review history.";

  const userPrompt = `Please generate a mastery confirmation quiz for the following knowledge point.

Knowledge point title: ${kpRow.title}
Student's recent performance: ${recentPerformance}

Generate exactly 3 questions that fairly assess whether the student has truly mastered this knowledge point. Use a mix of single-choice and multiple-choice questions as appropriate. For single-choice questions, mark exactly one choice as correct. For multiple-choice questions, mark all correct choices. Each question must include a concise explanation of the correct answer and a unique string id.`;

  const quiz = await generateStructured<MasteryQuiz>(
    systemPrompt,
    userPrompt,
    masterySchema
  );

  const insertRes = await pool.query(
    `INSERT INTO quiz_attempts (user_id, kp_id, quiz_data, generated_from, review_item_id)
     VALUES ($1, $2, $3, 'mastery', NULL)
     RETURNING id`,
    [userId, kpId, quiz]
  );
  const quizAttemptId = (insertRes.rows[0] as { id: number }).id;

  return { quizAttemptId, quiz };
}

/**
 * Submit answers to a mastery confirmation quiz.
 *
 * All three questions must be answered correctly to pass. Any wrong answer
 * reverts the review item to "relearning" state.
 */
export async function submitMasteryGate(
  userId: number,
  kpId: number,
  quizAttemptId: number,
  answers: { questionId: string; selectedIndex: number }[]
): Promise<{
  allCorrect: boolean;
  results: { questionId: string; correct: boolean; explanation: string }[];
  masteryState: string;
}> {
  const quizRes = await pool.query(
    `SELECT id, quiz_data FROM quiz_attempts
     WHERE id = $1 AND user_id = $2 AND kp_id = $3 AND generated_from = 'mastery'
     LIMIT 1`,
    [quizAttemptId, userId, kpId]
  );

  if (quizRes.rows.length === 0) {
    throw new Error("Quiz attempt not found");
  }

  const quizRow = quizRes.rows[0] as { id: number; quiz_data: MasteryQuiz };
  const quiz = quizRow.quiz_data;

  const results = quiz.questions.map((question) => {
    const answer = answers.find((a) => a.questionId === question.id);
    let correct = false;
    if (answer) {
      const choice = question.choices[answer.selectedIndex];
      correct = choice?.isCorrect ?? false;
    }
    return {
      questionId: question.id,
      correct,
      explanation: question.explanation,
    };
  });

  const allCorrect = results.every((r) => r.correct);
  const correctCount = results.filter((r) => r.correct).length;

  await pool.query(
    `UPDATE quiz_attempts SET correct_count = $1, all_correct = $2 WHERE id = $3`,
    [correctCount, allCorrect, quizAttemptId]
  );

  let masteryState: string;
  if (allCorrect) {
    // Gate passed — mark as mastered directly. updateMastery() in fsrs-engine
    // requires consecutiveCorrect >= 3 which may not hold here (the gate
    // triggers at >= 2), so we set the state explicitly.
    await pool.query(
      `UPDATE review_items SET state = 'mastered', updated_at = NOW()
       WHERE user_id = $1 AND kp_id = $2`,
      [userId, kpId]
    );
    masteryState = "mastered";
  } else {
    await pool.query(
      `UPDATE review_items
       SET state = 'relearning', consecutive_correct = 0, lapses = lapses + 1, updated_at = NOW()
       WHERE user_id = $1 AND kp_id = $2`,
      [userId, kpId]
    );
    masteryState = "relearning";
  }

  return { allCorrect, results, masteryState };
}
