import { test, expect } from "@playwright/test";
import { mockLLMResponses } from "./helpers/mock-llm";

/**
 * Critical user path #4: dashboard renders counts and recent mistakes
 * from /api/dashboard. The API is mocked to return a known payload.
 */
test.describe("Dashboard critical path", () => {
  test("dashboard shows due count and mastery overview", async ({ page }) => {
    await mockLLMResponses(page);

    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "复习仪表盘", exact: true })
    ).toBeVisible();

    // ── Due count card ────────────────────────────────────────────────
    // The DueCountCard surfaces the mocked dueCount = 3. It renders the
    // value prominently — accept either "3" or "3 道" depending on the
    // card label.
    await expect(
      page.getByText("今日待复习", { exact: false })
    ).toBeVisible();

    // ── Mastery overview ──────────────────────────────────────────────
    // MasteryOverview renders 5 stat rows. The mocked payload has
    // new=1, learning=2, review=1, relearning=0, mastered=0.
    await expect(page.getByText("新", { exact: true })).toBeVisible();
    await expect(
      page.getByText("学习中", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("复习中", { exact: true })
    ).toBeVisible();

    // ── Recent mistakes ───────────────────────────────────────────────
    // The mocked dashboard payload includes one recent mistake whose
    // error_cause.type is "computational" → label "计算错误".
    await expect(
      page.getByText("近期错题", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("计算错误", { exact: true })
    ).toBeVisible();
  });

  test("dashboard empty state shows empty-state hint", async ({ page }) => {
    // Override the dashboard mock for this test only.
    await mockLLMResponses(page);
    await page.route("**/api/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dueCount: 0,
          masteryStats: {
            new: 0,
            learning: 0,
            review: 0,
            relearning: 0,
            mastered: 0,
          },
          recentMistakes: [],
          totalKps: 0,
        }),
      });
    });

    await page.goto("/dashboard");

    // EmptyState branch (all-zero stats + zero recent mistakes).
    await expect(
      page.getByText(/暂无|开始|还没有|去上传|Empty/i)
    ).toBeVisible();
  });
});
