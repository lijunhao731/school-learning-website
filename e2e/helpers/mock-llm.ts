import type { Page, Route } from "@playwright/test";

/**
 * Mock fixture: a fake but realistic auth_session cookie. The Next.js
 * middleware only checks for the *presence* of the cookie before letting
 * a request through; the actual `getSession()` server-side call is
 * bypassed because every API endpoint the UI touches is intercepted by
 * `page.route()` below, so the request never reaches the server route
 * handler.
 */
export const AUTH_COOKIE_NAME = "auth_session";
export const AUTH_COOKIE_VALUE = "e2e-mock-session-id";
export const BASE_URL = "http://localhost:3000";

/**
 * Set a fake auth_session cookie on the page context so the Next.js
 * middleware (which guards /api/* except /api/auth/* and /api/health)
 * treats the request as authenticated.
 */
export async function setAuthCookie(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: AUTH_COOKIE_VALUE,
      url: BASE_URL,
    },
  ]);
}

/**
 * Fulfill a route with JSON. Centralized to keep test bodies terse and
 * avoid repeating the same options object.
 */
async function fulfillJson(
  route: Route,
  status: number,
  body: unknown
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Fulfill a route with a plain-text stream. The knowledge intro/detail
 * endpoints call `result.toTextStreamResponse()` server-side, so the
 * browser receives a text stream; we mock it with a fixed string.
 */
async function fulfillText(
  route: Route,
  body: string
): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/plain; charset=utf-8",
    body,
  });
}

/**
 * Install every mock route the E2E suite needs:
 *  - Auth: register, login, me
 *  - Mistakes: list, upload, OCR, analyze, similar-questions
 *  - Knowledge: tree, intro/detail (stream), examples, practice
 *  - Review: session GET, answer POST
 *  - Dashboard: GET
 *
 * Each call to `page.route()` registers an additional handler; Playwright
 * runs handlers in reverse-registration order, so the more specific
 * patterns (e.g. `/api/mistakes/analyze`) are matched before the more
 * general `/api/mistakes` list pattern.
 */
export async function mockLLMResponses(page: Page): Promise<void> {
  // 1. Auth cookie — must be set BEFORE navigation so middleware passes.
  await setAuthCookie(page);

  // ---- Auth ----
  await page.route("**/api/auth/register", async (route) => {
    await fulfillJson(route, 201, {
      id: 1,
      username: "testuser",
      role: "student",
      name: "Test User",
      grade: 3,
    });
  });

  await page.route("**/api/auth/login", async (route) => {
    await fulfillJson(route, 200, { id: 1, username: "testuser" });
  });

  await page.route("**/api/auth/me", async (route) => {
    await fulfillJson(route, 200, {
      id: 1,
      username: "testuser",
      role: "student",
      name: "Test User",
      grade: 3,
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    await fulfillJson(route, 200, { ok: true });
  });

  // ---- OCR (LLM-vision pipeline) ----
  await page.route("**/api/ocr", async (route) => {
    await fulfillJson(route, 200, {
      text: "计算 3+5",
      formulas: [],
      fullText: "计算 3+5",
      source: "llm-vision",
    });
  });

  // ---- Mistake upload (file save) ----
  await page.route("**/api/mistakes/upload", async (route) => {
    await fulfillJson(route, 200, {
      imageUrl: "/uploads/e2e-test-photo.jpg",
    });
  });

  // ---- Mistake error analysis (LLM) ----
  await page.route("**/api/mistakes/analyze", async (route) => {
    await fulfillJson(route, 200, {
      questionType: "arithmetic",
      errorCause: {
        type: "computational",
        description: "加法计算错误",
      },
      solutionApproach: [{ step: 1, explanation: "3+5=8" }],
      relatedKpIds: ["1"],
      difficulty: "easy",
      mistakeId: 1,
    });
  });

  // ---- Similar questions generation (LLM) ----
  await page.route(
    /\/api\/mistakes\/\d+\/similar-questions$/,
    async (route) => {
      await fulfillJson(route, 200, {
        questions: [
          {
            id: "q1",
            type: "single-choice" as const,
            question: "2+3=?",
            choices: [
              { text: "5", isCorrect: true },
              { text: "6", isCorrect: false },
              { text: "4", isCorrect: false },
              { text: "7", isCorrect: false },
            ],
            explanation: "2+3=5",
            targetsKp: "1",
          },
        ],
      });
    }
  );

  // ---- Mistakes list (DB) ----
  // Glob `**/api/mistakes*` matches both /api/mistakes and the list-with-query
  // form /api/mistakes?page=1&limit=10. The more specific /api/mistakes/{upload,
  // analyze, <id>/similar-questions} routes above take precedence because they
  // were registered first and Playwright checks in reverse order.
  await page.route(/\/api\/mistakes(?:\?.*)?$/, async (route) => {
    const url = route.request().url();
    // Only the bare list endpoint — let upload/analyze fall through to the
    // more specific handlers registered above.
    if (
      url.includes("/api/mistakes/upload") ||
      url.includes("/api/mistakes/analyze")
    ) {
      await route.fallback();
      return;
    }
    await fulfillJson(route, 200, {
      items: [
        {
          id: 1,
          kp_id: 1,
          image_url: "/uploads/e2e-test-photo.jpg",
          ocr_text: "计算 3+5",
          question_text: "3+5=?",
          student_answer: "7",
          error_cause: {
            type: "computational",
            description: "加法计算错误",
          },
          solution_approach: [{ step: 1, explanation: "3+5=8" }],
          related_kp_ids: ["1"],
          created_at: "2024-01-01T00:00:00.000Z",
          mastery_state: "learning",
          kp_title: "加减法",
        },
      ],
      total: 1,
      hasMore: false,
    });
  });

  // ---- Knowledge tree (LLM-generated on first run, cached afterwards) ----
  // NOTE: the API returns `{ trees: [...] }` but the TreeSidebar client
  // consumes `{ tree: [...] }`. We mock the shape the client reads so the
  // E2E flow mirrors what the user would see once the API/frontend shapes
  // are aligned.
  await page.route("**/api/knowledge/tree", async (route) => {
    await fulfillJson(route, 200, {
      tree: [
        {
          id: 1,
          subject: "math",
          grade_level: 3,
          chapter: "ch1",
          title: "加减法",
          ltree_path: "1",
          parent_id: null,
          created_at: null,
          children: [
            {
              id: 2,
              subject: "math",
              grade_level: 3,
              chapter: "ch1",
              title: "加法",
              ltree_path: "1.2",
              parent_id: 1,
              created_at: null,
              children: [],
            },
          ],
        },
      ],
    });
  });

  // ---- Knowledge intro/detail (text streams from LLM) ----
  await page.route(/\/api\/knowledge\/\d+\/intro$/, async (route) => {
    await fulfillText(
      route,
      "加法是把两个数合并成一个数的运算。"
    );
  });

  await page.route(/\/api\/knowledge\/\d+\/detail$/, async (route) => {
    await fulfillText(
      route,
      "详细讲解：3+5 表示三个物体加上五个物体，共八个。"
    );
  });

  // ---- Knowledge examples (LLM) ----
  await page.route(/\/api\/knowledge\/\d+\/examples$/, async (route) => {
    await fulfillJson(route, 200, {
      examples: [
        {
          question: "例题：1+2=?",
          solution: "1+2=3",
          explanation: "1 加 2 等于 3。",
          difficulty: "easy" as const,
        },
      ],
    });
  });

  // ---- Knowledge practice quiz (LLM) ----
  await page.route(/\/api\/knowledge\/\d+\/practice$/, async (route) => {
    await fulfillJson(route, 200, {
      questions: [
        {
          id: "p1",
          type: "single-choice" as const,
          question: "4+5=?",
          choices: ["9", "8", "10", "7"],
          answer: 0,
          explanation: "4+5=9",
        },
      ],
    });
  });

  // ---- Review session (builds from due items + similar questions) ----
  await page.route("**/api/review/session", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await fulfillJson(route, 200, {
      sessionId: "e2e-review-session",
      items: [
        {
          kpId: 1,
          reviewItemId: 1,
          quizAttemptId: 1,
          question: "2+3=?",
          choices: [
            { text: "5", isCorrect: true },
            { text: "6", isCorrect: false },
            { text: "4", isCorrect: false },
            { text: "7", isCorrect: false },
          ],
          explanation: "2+3=5",
          targetsKp: "1",
        },
      ],
    });
  });

  // ---- Review answer (FSRS scheduling + mastery update) ----
  await page.route(
    /\/api\/review\/session\/[^/]+\/answer$/,
    async (route) => {
      await fulfillJson(route, 200, {
        correct: true,
        explanation: "2+3=5",
        masteryState: "mastered",
        isMastered: true,
      });
    }
  );

  // ---- Dashboard (DB aggregates) ----
  await page.route("**/api/dashboard", async (route) => {
    await fulfillJson(route, 200, {
      dueCount: 3,
      masteryStats: {
        new: 1,
        learning: 2,
        review: 1,
        relearning: 0,
        mastered: 0,
      },
      recentMistakes: [
        {
          id: 1,
          kpId: 1,
          imageUrl: "/uploads/e2e-test-photo.jpg",
          errorCause: {
            type: "computational",
            description: "加法计算错误",
          },
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      totalKps: 12,
    });
  });
}
