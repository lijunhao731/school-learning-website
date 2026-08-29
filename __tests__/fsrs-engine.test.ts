import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  scheduleReview,
  getDueItems,
  createReviewItem,
  Rating,
  type ReviewItem,
} from "@/lib/mastery/fsrs-engine";

// Stable mock references — avoids vi.mocked() picking the wrong pg.Pool.query
// overload (callback-style returns void, breaking mockResolvedValue typing).
const dbMocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  pool: {
    query: dbMocks.query,
    connect: dbMocks.connect,
  },
}));

function makeReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 1,
    userId: 1,
    kpId: 1,
    state: "review",
    stability: 5.0,
    difficulty: 5.0,
    dueDate: new Date(),
    interval: 3,
    lapses: 0,
    reps: 3,
    consecutiveCorrect: 3,
    lastReview: new Date(Date.now() - 86_400_000),
    desiredRetention: 0.9,
    ...overrides,
  };
}

/**
 * Build a mock DB client that reflects UPDATE / INSERT params back as row
 * objects, so rowToReviewItem / rowToReviewLog see the values scheduleReview
 * computed via ts-fsrs.
 */
function createMockClient() {
  return {
    query: vi.fn(async (text: string, params?: unknown[]) => {
      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") {
        return { rows: [] };
      }
      if (text.startsWith("UPDATE review_items")) {
        const [
          state,
          stability,
          difficulty,
          dueDate,
          interval,
          lapses,
          reps,
          consecutiveCorrect,
          lastReview,
          id,
        ] = (params ?? []) as [
          string, number, number, Date, number, number, number,
          number, Date, number,
        ];
        return {
          rows: [
            {
              id,
              user_id: 1,
              kp_id: 1,
              state,
              stability,
              difficulty,
              due_date: dueDate,
              interval,
              lapses,
              reps,
              consecutive_correct: consecutiveCorrect,
              last_review: lastReview,
              desired_retention: 0.9,
            },
          ],
        };
      }
      if (text.startsWith("INSERT INTO review_logs")) {
        const [
          reviewItemId,
          rating,
          state,
          reviewedAt,
          due,
          stability,
          difficulty,
          interval,
          correct,
        ] = (params ?? []) as [
          number, string, string, Date, Date, number, number, number, boolean,
        ];
        return {
          rows: [
            {
              id: 100,
              review_item_id: reviewItemId,
              rating,
              state,
              reviewed_at: reviewedAt,
              due,
              stability,
              difficulty,
              interval,
              correct,
            },
          ],
        };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };
}

describe("FSRS Engine", () => {
  beforeEach(() => {
    dbMocks.query.mockReset();
    dbMocks.connect.mockReset();
  });

  // ── createReviewItem ────────────────────────────────────────────────────

  describe("createReviewItem", () => {
    it("initializes a new card with state=new, reps=0, lapses=0", async () => {
      const now = new Date();
      dbMocks.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            user_id: 10,
            kp_id: 20,
            state: "new",
            stability: 0,
            difficulty: 0,
            due_date: now,
            interval: 0,
            lapses: 0,
            reps: 0,
            consecutive_correct: 0,
            last_review: null,
            desired_retention: 0.9,
          },
        ],
        rowCount: 1,
      });

      const item = await createReviewItem(20, 10);

      expect(item.state).toBe("new");
      expect(item.reps).toBe(0);
      expect(item.lapses).toBe(0);
      expect(item.consecutiveCorrect).toBe(0);
      expect(item.stability).toBe(0);
      expect(item.difficulty).toBe(0);
      expect(item.desiredRetention).toBe(0.9);
      expect(item.userId).toBe(10);
      expect(item.kpId).toBe(20);

      // Verify the INSERT query was called with the right initial values
      const call = dbMocks.query.mock.calls[0];
      expect(call[0]).toContain("INSERT INTO review_items");
      expect(call[1]).toEqual([10, 20, expect.any(Date)]);
    });
  });

  // ── scheduleReview ──────────────────────────────────────────────────────

  describe("scheduleReview", () => {
    it("increases stability, reps, and consecutiveCorrect for Good rating", async () => {
      const item = makeReviewItem({
        stability: 5.0,
        reps: 3,
        consecutiveCorrect: 3,
        lapses: 0,
      });
      const mockClient = createMockClient();
      dbMocks.connect.mockResolvedValue(mockClient);

      const { updatedItem, reviewLog } = await scheduleReview(item, Rating.Good);

      expect(updatedItem.reps).toBe(4);
      expect(updatedItem.consecutiveCorrect).toBe(4);
      expect(updatedItem.stability).toBeGreaterThan(item.stability);
      expect(updatedItem.lapses).toBe(0);

      expect(reviewLog.rating).toBe("good");
      expect(reviewLog.correct).toBe(true);
      expect(reviewLog.reviewItemId).toBe(item.id);

      // Transaction lifecycle
      const sqlCalls = mockClient.query.mock.calls.map((c) => c[0]);
      expect(sqlCalls).toContain("BEGIN");
      expect(sqlCalls).toContain("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("resets consecutiveCorrect and increments lapses for Again rating", async () => {
      const item = makeReviewItem({
        stability: 5.0,
        reps: 3,
        consecutiveCorrect: 3,
        lapses: 1,
      });
      const mockClient = createMockClient();
      dbMocks.connect.mockResolvedValue(mockClient);

      const { updatedItem, reviewLog } = await scheduleReview(item, Rating.Again);

      expect(updatedItem.consecutiveCorrect).toBe(0);
      expect(updatedItem.lapses).toBe(2);
      expect(updatedItem.reps).toBe(4);

      expect(reviewLog.rating).toBe("again");
      expect(reviewLog.correct).toBe(false);
    });

    it("rolls back and rethrows on DB error", async () => {
      const item = makeReviewItem();
      const mockClient = createMockClient();
      mockClient.query.mockImplementation(async (text: string) => {
        if (text === "BEGIN") return { rows: [] };
        throw new Error("DB connection lost");
      });
      dbMocks.connect.mockResolvedValue(mockClient);

      await expect(scheduleReview(item, Rating.Good)).rejects.toThrow(
        "DB connection lost"
      );

      const sqlCalls = mockClient.query.mock.calls.map((c) => c[0]);
      expect(sqlCalls).toContain("BEGIN");
      expect(sqlCalls).toContain("ROLLBACK");
      expect(sqlCalls).not.toContain("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // ── getDueItems ─────────────────────────────────────────────────────────

  describe("getDueItems", () => {
    it("returns mapped review items for a user", async () => {
      const now = new Date();
      dbMocks.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            user_id: 5,
            kp_id: 10,
            state: "review",
            stability: 3.0,
            difficulty: 5.0,
            due_date: now,
            interval: 2,
            lapses: 0,
            reps: 2,
            consecutive_correct: 1,
            last_review: now,
            desired_retention: 0.9,
          },
          {
            id: 2,
            user_id: 5,
            kp_id: 20,
            state: "learning",
            stability: 1.0,
            difficulty: 7.0,
            due_date: now,
            interval: 0,
            lapses: 1,
            reps: 1,
            consecutive_correct: 0,
            last_review: now,
            desired_retention: 0.9,
          },
        ],
        rowCount: 2,
      });

      const items = await getDueItems(5);

      expect(items).toHaveLength(2);
      expect(items[0].id).toBe(1);
      expect(items[0].userId).toBe(5);
      expect(items[0].state).toBe("review");
      expect(items[1].id).toBe(2);
      expect(items[1].state).toBe("learning");
      expect(items[1].lapses).toBe(1);

      const call = dbMocks.query.mock.calls[0];
      expect(call[0]).toContain("due_date <= NOW()");
      expect(call[0]).toContain("state != 'mastered'");
      expect(call[1]).toEqual([5]);
    });

    it("returns empty array when no due items", async () => {
      dbMocks.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const items = await getDueItems(99);
      expect(items).toEqual([]);
    });
  });
});
