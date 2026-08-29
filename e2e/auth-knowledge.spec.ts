import { test, expect } from "@playwright/test";
import { mockLLMResponses } from "./helpers/mock-llm";

/**
 * Critical user path #1: register → login → browse knowledge tree →
 * view knowledge point detail → do practice question.
 *
 * Auth is mocked by setting the auth_session cookie + intercepting the
 * /api/auth/* endpoints, so no real DB or Lucia session is required.
 */
test.describe("Auth + Knowledge critical path", () => {
  test("register then view a knowledge point and answer a practice question", async ({
    page,
  }) => {
    await mockLLMResponses(page);

    // ── Step 1: register ───────────────────────────────────────────────
    // The app exposes no /register page; registration is performed via the
    // API. We POST directly from a browser context so the auth cookie set
    // by the mocked response is attached to subsequent navigations.
    const registerRes = await page.request.post("/api/auth/register", {
      data: {
        username: "testuser",
        password: "password123",
        name: "Test User",
        grade: 3,
      },
    });
    expect(registerRes.status()).toBe(201);
    const registerBody = await registerRes.json();
    expect(registerBody.username).toBe("testuser");

    // ── Step 2: confirm /api/auth/me reports an authenticated user ───
    const meRes = await page.request.get("/api/auth/me");
    expect(meRes.status()).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.username).toBe("testuser");

    // ── Step 3: browse the knowledge tree (knowledge detail page) ─────
    // The knowledge detail page at /knowledge/[id] renders the TreeSidebar
    // alongside the content. Navigating to /knowledge/1 exercises both the
    // tree fetch and the detail/intro/examples/practice fetches.
    await page.goto("/knowledge/1");

    // Page heading "核心概念" marks the intro section.
    await expect(
      page.getByRole("heading", { name: "核心概念", exact: true })
    ).toBeVisible();

    // The intro stream mock returns a fixed Chinese sentence.
    await expect(page.getByText("加法是把两个数合并成一个数的运算。")).toBeVisible();

    // Detail section heading and streamed content.
    await expect(
      page.getByRole("heading", { name: "详细讲解", exact: true })
    ).toBeVisible();

    // ── Step 4: practice question ─────────────────────────────────────
    await expect(
      page.getByRole("heading", { name: "练习", exact: true })
    ).toBeVisible();

    // Mock practice returns one question "4+5=?" with correct answer "9"
    // (index 0) — click the choice labeled "9".
    const practiceQuestion = page.getByText("4+5=?", { exact: false });
    await expect(practiceQuestion).toBeVisible();

    const correctChoice = page.getByRole("button", {
      name: "9",
      exact: true,
    });
    await correctChoice.click();

    // After answering, the MCQuestion component shows feedback.
    await expect(page.getByText("回答正确")).toBeVisible();
    await expect(page.getByText("4+5=9")).toBeVisible();
  });

  test("login flow returns ok for an existing user", async ({ page }) => {
    await mockLLMResponses(page);

    const loginRes = await page.request.post("/api/auth/login", {
      data: { username: "testuser", password: "password123" },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.id).toBe(1);
    expect(loginBody.username).toBe("testuser");
  });
});
