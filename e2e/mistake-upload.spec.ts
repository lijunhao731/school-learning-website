import { test, expect } from "@playwright/test";
import { mockLLMResponses } from "./helpers/mock-llm";

/**
 * Critical user path #2: upload mistake photo → OCR → edit/confirm →
 * error analysis → answer similar question.
 *
 * Drives the MistakeUploadWizard across all 5 steps (photo → ocr →
 * analysis → quiz → summary). All LLM calls are mocked at the
 * `page.route()` layer so no real OCR / analyzer / generator runs.
 */
test.describe("Mistake upload wizard critical path", () => {
  test("upload → OCR → analyze → answer similar question → summary", async ({
    page,
  }) => {
    await mockLLMResponses(page);

    await page.goto("/mistakes/upload");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "上传错题", exact: true })
    ).toBeVisible();

    // ── Step 1: photo ─────────────────────────────────────────────────
    // The PhotoUpload component uses an <input type="file">. We attach
    // a tiny JPEG file via setInputFiles() — the upload itself is mocked
    // by `**/api/mistakes/upload`.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(
        // Minimal 1x1 JPEG (SOI + EOI markers).
        Uint8Array.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
          0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
        ])
      ),
    });

    // After upload succeeds, the wizard auto-advances to the OCR step.
    // Wait for the OCR textarea to appear and contain the mocked text.
    const ocrTextarea = page.locator("textarea").first();
    await expect(ocrTextarea).toBeVisible();
    // The mock OCR response provides text "计算 3+5".
    await expect(page.locator("textarea")).toHaveValue(/计算 3\+5/);

    // ── Step 2: confirm OCR text ───────────────────────────────────────
    await page.getByRole("button", { name: "确认", exact: true }).click();

    // ── Step 3: analysis ──────────────────────────────────────────────
    // The Analysis step renders a "开始分析" button. Click it to fire
    // the mocked /api/mistakes/analyze call.
    await page.getByRole("button", { name: "开始分析", exact: true }).click();

    // The mock returns an analysis with type=computational and a 1-step
    // solution approach. The AnalysisResult component renders a tag for
    // the error type label "计算错误" and shows "3+5=8" in the steps.
    await expect(page.getByText("计算错误", { exact: true })).toBeVisible();
    await expect(page.getByText("加法计算错误")).toBeVisible();
    await expect(page.getByText("3+5=8")).toBeVisible();

    // Continue to the quiz step.
    await page.getByRole("button", { name: "继续", exact: true }).click();

    // ── Step 4: quiz ───────────────────────────────────────────────────
    // Mock similar-questions response returns one question "2+3=?"
    // with the correct choice "5".
    await expect(page.getByText("2+3=?", { exact: false })).toBeVisible();

    // Single-choice mode auto-submits on click — click "5".
    await page.getByRole("button", { name: "5", exact: true }).click();

    // Feedback appears: "回答正确"
    await expect(page.getByText("回答正确", { exact: true })).toBeVisible();

    // The "完成" button becomes enabled after answering all questions.
    await page.getByRole("button", { name: "完成", exact: true }).click();

    // ── Step 5: summary ────────────────────────────────────────────────
    // Summary step shows score and accuracy. We answered 1/1 correct →
    // 100% accuracy → mastery plan recommends "3 天后复习".
    await expect(page.getByText("1/1")).toBeVisible();
    await expect(page.getByText("正确率 100%")).toBeVisible();
  });
});
