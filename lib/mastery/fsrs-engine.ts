import { fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import { pool } from "@/lib/db/client";

// Re-export so callers can import Rating/State alongside the engine functions
export { Rating, State } from "ts-fsrs";

// ────────────────────────────────────────────────────────────────────────────
// Public interfaces
// ────────────────────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: number;
  userId: number;
  kpId: number;
  state: string; // new | learning | review | relearning | mastered
  stability: number;
  difficulty: number;
  dueDate: Date | null;
  interval: number; // days
  lapses: number;
  reps: number;
  consecutiveCorrect: number;
  lastReview: Date | null;
  desiredRetention: number;
}

export interface ReviewLog {
  id: number;
  reviewItemId: number;
  rating: string; // again | hard | good | easy
  state: string;
  reviewedAt: Date;
  due: Date | null;
  stability: number;
  difficulty: number;
  interval: number;
  correct: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal: DB row shapes (snake_case) and mapping helpers
// ────────────────────────────────────────────────────────────────────────────

interface ReviewItemRow {
  id: number;
  user_id: number;
  kp_id: number;
  state: string | null;
  stability: number | null;
  difficulty: number | null;
  due_date: Date | null;
  interval: number | null;
  lapses: number | null;
  reps: number | null;
  consecutive_correct: number | null;
  last_review: Date | null;
  desired_retention: number | null;
}

interface ReviewLogRow {
  id: number;
  review_item_id: number;
  rating: string | null;
  state: string | null;
  reviewed_at: Date | null;
  due: Date | null;
  stability: number | null;
  difficulty: number | null;
  interval: number | null;
  correct: boolean | null;
}

function rowToReviewItem(row: ReviewItemRow): ReviewItem {
  return {
    id: row.id,
    userId: row.user_id,
    kpId: row.kp_id,
    state: row.state ?? "new",
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    dueDate: row.due_date,
    interval: row.interval ?? 0,
    lapses: row.lapses ?? 0,
    reps: row.reps ?? 0,
    consecutiveCorrect: row.consecutive_correct ?? 0,
    lastReview: row.last_review,
    desiredRetention: row.desired_retention ?? 0.9,
  };
}

function rowToReviewLog(row: ReviewLogRow): ReviewLog {
  return {
    id: row.id,
    reviewItemId: row.review_item_id,
    rating: row.rating ?? "good",
    state: row.state ?? "new",
    reviewedAt: row.reviewed_at ?? new Date(),
    due: row.due,
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    interval: row.interval ?? 0,
    correct: row.correct ?? false,
  };
}

/** Map ts-fsrs State enum to our DB state string. */
function stateToString(state: State): string {
  switch (state) {
    case State.New:
      return "new";
    case State.Learning:
      return "learning";
    case State.Review:
      return "review";
    case State.Relearning:
      return "relearning";
    default:
      return "new";
  }
}

/** Map our DB state string to ts-fsrs State enum. "mastered" has no enum
 *  equivalent and is treated as Review so scheduling can still proceed. */
function stringToState(state: string): State {
  switch (state) {
    case "new":
      return State.New;
    case "learning":
      return State.Learning;
    case "review":
      return State.Review;
    case "relearning":
      return State.Relearning;
    case "mastered":
      return State.Review;
    default:
      return State.New;
  }
}

/** Map ts-fsrs Rating enum to our DB rating string. */
function ratingToString(rating: Rating): string {
  switch (rating) {
    case Rating.Again:
      return "again";
    case Rating.Hard:
      return "hard";
    case Rating.Good:
      return "good";
    case Rating.Easy:
      return "easy";
    default:
      return "good";
  }
}

/** Convert a ReviewItem (DB camelCase) into a ts-fsrs Card for scheduling. */
function reviewItemToCard(item: ReviewItem): Card {
  const now = new Date();
  return {
    due: item.dueDate ?? now,
    stability: item.stability,
    difficulty: item.difficulty,
    elapsed_days: 0,
    scheduled_days: item.interval,
    learning_steps: 0,
    reps: item.reps,
    lapses: item.lapses,
    state: stringToState(item.state),
    last_review: item.lastReview ?? undefined,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a new review item for a (user, knowledge-point) pair.
 * Initial state: new, stability=0, difficulty=0, reps=0, lapses=0,
 * consecutiveCorrect=0, dueDate=now, desiredRetention=0.9.
 */
export async function createReviewItem(
  kpId: number,
  userId: number
): Promise<ReviewItem> {
  const now = new Date();
  const res = await pool.query(
    `INSERT INTO review_items
       (user_id, kp_id, state, stability, difficulty, due_date, interval,
        lapses, reps, consecutive_correct, last_review, desired_retention)
     VALUES ($1, $2, 'new', 0, 0, $3, 0, 0, 0, 0, NULL, 0.9)
     RETURNING *`,
    [userId, kpId, now]
  );
  return rowToReviewItem(res.rows[0] as ReviewItemRow);
}

/**
 * Schedule the next review for a review item using the ts-fsrs algorithm.
 *
 * Rating mapping (per app convention):
 *   - Choice question answered correctly  -> Rating.Good (3)
 *   - Choice question answered incorrectly -> Rating.Again (1)
 *
 * Updates the review_items row (stability, difficulty, interval, dueDate,
 * reps, lapses, consecutiveCorrect, lastReview, state) and inserts a
 * review_logs row — both inside a single transaction.
 */
export async function scheduleReview(
  reviewItem: ReviewItem,
  rating: Rating
): Promise<{ updatedItem: ReviewItem; reviewLog: ReviewLog }> {
  const now = new Date();
  const f = fsrs({ request_retention: reviewItem.desiredRetention });
  const card = reviewItemToCard(reviewItem);
  const result = f.next(card, now, rating as Grade);
  const newCard = result.card;

  const newState = stateToString(newCard.state);
  const newInterval = newCard.scheduled_days;
  const correct = rating !== Rating.Again;
  const newConsecutiveCorrect = correct
    ? reviewItem.consecutiveCorrect + 1
    : 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateRes = await client.query(
      `UPDATE review_items
       SET state = $1, stability = $2, difficulty = $3, due_date = $4,
           interval = $5, lapses = $6, reps = $7, consecutive_correct = $8,
           last_review = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        newState,
        newCard.stability,
        newCard.difficulty,
        newCard.due,
        newInterval,
        newCard.lapses,
        newCard.reps,
        newConsecutiveCorrect,
        now,
        reviewItem.id,
      ]
    );
    const updatedItem = rowToReviewItem(updateRes.rows[0] as ReviewItemRow);

    const logRes = await client.query(
      `INSERT INTO review_logs
         (review_item_id, rating, state, reviewed_at, due, stability,
          difficulty, interval, correct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        reviewItem.id,
        ratingToString(rating),
        newState,
        now,
        newCard.due,
        newCard.stability,
        newCard.difficulty,
        newInterval,
        correct,
      ]
    );
    const reviewLog = rowToReviewLog(logRes.rows[0] as ReviewLogRow);

    await client.query("COMMIT");
    return { updatedItem, reviewLog };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check whether a review item has reached mastery and update its state if so.
 *
 * Mastery criteria (N-CCR + R + reps):
 *   consecutiveCorrect >= 3 AND reps >= 3 AND retrievability >= 0.9
 *
 * If mastered, sets state='mastered' in the DB and returns the updated item.
 * Otherwise returns the item unchanged.
 */
export async function updateMastery(
  reviewItem: ReviewItem
): Promise<ReviewItem> {
  const f = fsrs({ request_retention: reviewItem.desiredRetention });
  const now = new Date();
  const card = reviewItemToCard(reviewItem);

  // Retrievability is only meaningful when the card has been reviewed
  // (stability > 0) and has a last_review timestamp.
  let retrievability = 0;
  if (reviewItem.stability > 0 && reviewItem.lastReview) {
    retrievability = f.get_retrievability(card, now, false);
  }

  const isMastered =
    reviewItem.consecutiveCorrect >= 3 &&
    reviewItem.reps >= 3 &&
    retrievability >= 0.9;

  if (!isMastered) {
    return reviewItem;
  }

  const res = await pool.query(
    `UPDATE review_items SET state = 'mastered', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [reviewItem.id]
  );
  return rowToReviewItem(res.rows[0] as ReviewItemRow);
}

/**
 * Get all review items due for a user (due_date <= now, not mastered),
 * ordered by due date ascending.
 */
export async function getDueItems(userId: number): Promise<ReviewItem[]> {
  const res = await pool.query(
    `SELECT * FROM review_items
     WHERE user_id = $1 AND due_date <= NOW() AND state != 'mastered'
     ORDER BY due_date ASC`,
    [userId]
  );
  return (res.rows as ReviewItemRow[]).map(rowToReviewItem);
}

/**
 * Get the review item for a specific (user, knowledge-point) pair, or null
 * if none exists.
 */
export async function getReviewItem(
  userId: number,
  kpId: number
): Promise<ReviewItem | null> {
  const res = await pool.query(
    `SELECT * FROM review_items WHERE user_id = $1 AND kp_id = $2 LIMIT 1`,
    [userId, kpId]
  );
  const row = res.rows[0] as ReviewItemRow | undefined;
  return row ? rowToReviewItem(row) : null;
}
