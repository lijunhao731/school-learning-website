import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Stable mock references that survive vi.resetModules()
const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  recognize: vi.fn(),
}));

vi.mock("fs", () => ({
  promises: {
    readFile: mocks.readFile,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("tesseract.js", () => ({
  default: { recognize: mocks.recognize },
}));

describe("OCR Pipeline", () => {
  let runOCRPipeline: typeof import("@/lib/ocr/pipeline").runOCRPipeline;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Default: fs.readFile returns a fake image buffer
    mocks.readFile.mockResolvedValue(Buffer.from("fake-image-data"));
    mocks.recognize.mockReset();

    const mod = await import("@/lib/ocr/pipeline");
    runOCRPipeline = mod.runOCRPipeline;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses LLM vision when available", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                text: "What is 5 + 3?",
                formulas: [{ latex: "5 + 3" }],
              }),
            },
          },
        ],
      }),
    });

    const result = await runOCRPipeline("/uploads/math.jpg");

    expect(result.source).toBe("llm-vision");
    expect(result.text).toContain("5 + 3");
    expect(result.formulas).toHaveLength(1);
    expect(result.formulas[0].latex).toBe("5 + 3");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("falls back to Tesseract when LLM vision fails", async () => {
    // LLM vision returns non-ok response for all model attempts
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    mocks.recognize.mockResolvedValue({
      data: { text: "Tesseract recognized this text from the image" },
    });

    const result = await runOCRPipeline("/uploads/math.jpg");

    expect(result.source).toBe("tesseract");
    expect(result.text).toContain("Tesseract recognized");
    expect(result.formulas).toEqual([]);
    expect(mocks.recognize).toHaveBeenCalled();
  });

  it("falls back to Tesseract when LLM vision throws a network error", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));

    mocks.recognize.mockResolvedValue({
      data: { text: "Fallback text from Tesseract OCR engine" },
    });

    const result = await runOCRPipeline("/uploads/math.jpg");

    expect(result.source).toBe("tesseract");
    expect(result.text).toContain("Fallback text");
  });

  it("returns manual when both LLM vision and Tesseract fail", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    // Tesseract returns text below MIN_TESSERACT_TEXT_LENGTH (5)
    mocks.recognize.mockResolvedValue({
      data: { text: "ab" },
    });

    const result = await runOCRPipeline("/uploads/math.jpg");

    expect(result.source).toBe("manual");
    expect(result.text).toBe("");
    expect(result.formulas).toEqual([]);
    expect(result.fullText).toBe("");
  });

  it("returns manual when Tesseract throws", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    mocks.recognize.mockRejectedValue(new Error("Tesseract crashed"));

    const result = await runOCRPipeline("/uploads/math.jpg");

    expect(result.source).toBe("manual");
  });

  it("extracts text from JSON fenced in markdown code blocks", async () => {
    const fencedContent =
      "```json\n" +
      JSON.stringify({ text: "Fenced content", formulas: [] }) +
      "\n```";

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: fencedContent } }],
      }),
    });

    const result = await runOCRPipeline("/uploads/math.jpg");

    expect(result.source).toBe("llm-vision");
    expect(result.text).toBe("Fenced content");
  });
});
