import { test, expect } from "@playwright/test";
import { mockLLMResponses } from "./helpers/mock-llm";

/**
 * Critical user path #3: open review session → answer question → see
 * feedback → finish → see summary with mastery update.
 *
 * The /api/review/session GET endpoint is mocked to return one item,
 * and /api/review/session/:id/answer POST is mocked to return correct
 * + mastery=mastered.
 */
test.describe("Review session critical path", () => {
  test("load review session, answer correctly, see summary", async ({
    page,
  }) => {
    await mockLLMResponses(page);

    await page.goto("/review");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "复习", exact: true })
    ).toBeVisible();

    // The single mocked item has question "2+3=?" and 4 choices.
    await expect(
      page.getByText("第 1 / 1 题", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("2+3=?", { exact: false })).toBeVisible();

    // Select the correct choice "5" (label A.).
    await page.getByRole("button", { name: "5", exact: true }).click();

    // Submit answer.
    await page.getByRole("button", { name: "提交", exact: true }).click();

    // Feedback: correct answer + explanation + mastery badge.
    await expect(page.getByText("回答正确", { exact: true })).toBeVisible();
    await expect(page.getByText("2+3=5")).toBeVisible();
    // masteryState=mastered → MasteryBadge label "已掌握"
    await expect(page.getByText("已掌握", { exact: true })).toBeVisible();

    // Move to next / summary.
    await page.getByRole("button", { name: "查看总结", exact: true }).click();

    // Summary card with stats.
    await expect(page.getByText("复习完成", { exact: true })).toBeVisible();
    await expect(
      page.getByText("复习知识点", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("答对", { exact: true })).toBeVisible();
    await expect(page.getByText("新掌握", { exact: true })).toBeVisible();
    // 1 item total, 1 correct, 1 newly mastered.
    await expect(page.getByText("1", { exact: true })).toBeVisible();
  });

  test("empty review session shows the empty state", async ({ page }) => {
    // Override the session mock to return zero items just for this test.
    await mockLLMResponses(page);
    await page.route("**/api/review/session", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessionId: "empty", items: [] }),
      });
    });

    await page.goto("/review");

    await expect(
      page.getByText("暂无到期复习，做得好！", { exact: true })
    ).toBeVisible();
  });
});
