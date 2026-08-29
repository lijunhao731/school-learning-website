import { promises as fs } from "fs";
import path from "path";
import Tesseract from "tesseract.js";

export interface OCRResult {
  text: string;
  formulas: { latex: string }[];
  fullText: string;
  source: "llm-vision" | "tesseract" | "manual";
}

// Vision capability cache.
// null  = unprobed (first call will attempt LLM vision and set the flag)
// true  = LLM vision is supported (subsequent calls keep using it)
// false = LLM vision is unavailable (subsequent calls skip straight to Tesseract)
let visionSupported: boolean | null = null;

const LLM_TIMEOUT_MS = 30_000;
const MIN_TESSERACT_TEXT_LENGTH = 5;

const DEFAULT_LLM_BASE_URL = "http://36.133.77.84:64025/v1";
const DEFAULT_LLM_API_KEY =
  "gpustack_53402c89fc1b8ff0_7f055b69257ea707820ef6fae0804aa3";
const DEFAULT_LLM_MODEL_PREFERRED = "mm-l2";
const DEFAULT_LLM_MODEL_FALLBACK = "mm-l1";

interface VisionConfig {
  baseURL: string;
  apiKey: string;
  models: string[];
}

function getVisionConfig(): VisionConfig {
  const baseURL = (process.env.LLM_BASE_URL ?? DEFAULT_LLM_BASE_URL).replace(
    /\/$/,
    ""
  );
  const apiKey = process.env.LLM_API_KEY ?? DEFAULT_LLM_API_KEY;
  const models = [
    process.env.LLM_MODEL_PREFERRED ?? DEFAULT_LLM_MODEL_PREFERRED,
    process.env.LLM_MODEL_FALLBACK ?? DEFAULT_LLM_MODEL_FALLBACK,
  ];
  return { baseURL, apiKey, models };
}

const VISION_OCR_PROMPT = `你是一个专业的 OCR 识别助手。请仔细识别图片中的内容，提取题目文字和数学公式。

要求：
1. 提取所有可见的文字内容（题目、选项、说明等），保持原始顺序与结构。
2. 将数学公式提取为 LaTeX 格式，放入 formulas 数组。
3. 仅返回 JSON，不要包含任何解释文字或 Markdown 代码块标记。

返回格式（纯 JSON）：
{
  "text": "图片中所有文字的完整内容",
  "formulas": [{ "latex": "公式1的LaTeX" }]
}`;

// imageUrl format is "/uploads/filename.jpg" -> resolve to an absolute path on disk.
function resolveImagePath(imageUrl: string): string {
  const relative = imageUrl.replace(/^\//, "");
  return path.join(process.cwd(), relative);
}

function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      // .jpg / .jpeg / unknown default to jpeg
      return "image/jpeg";
  }
}

interface ParsedVisionPayload {
  text: string;
  formulas: { latex: string }[];
}

// The LLM may wrap JSON in ```json fences or surround it with prose.
// Try direct parse, then fence extraction, then a balanced slice as a last resort.
function extractJsonFromContent(content: string): ParsedVisionPayload | null {
  let candidate = content.trim();

  const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    candidate = fenceMatch[1].trim();
  }

  const direct = tryParsePayload(candidate);
  if (direct) return direct;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = candidate.slice(start, end + 1);
    return tryParsePayload(slice);
  }
  return null;
}

function tryParsePayload(raw: string): ParsedVisionPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const obj = parsed as { text?: unknown; formulas?: unknown };

  const text = typeof obj.text === "string" ? obj.text : "";

  let formulas: { latex: string }[] = [];
  if (Array.isArray(obj.formulas)) {
    formulas = obj.formulas
      .filter(
        (f): f is Record<string, unknown> =>
          f !== null && typeof f === "object"
      )
      .map((f) => ({
        latex:
          typeof f.latex === "string" ? f.latex : String(f.latex ?? ""),
      }))
      .filter((f) => f.latex.length > 0);
  }

  if (text.length === 0 && formulas.length === 0) return null;
  return { text, formulas };
}

async function callVisionModel(
  config: VisionConfig,
  model: string,
  dataUrl: string,
  signal: AbortSignal
): Promise<string | null> {
  const endpoint = `${config.baseURL}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_OCR_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) return null;
  return content;
}

// Tier 1: LLM Vision OCR (preferred).
// Returns null on any failure (network, timeout, unparseable response).
async function runLLMVisionOCR(imagePath: string): Promise<OCRResult | null> {
  const config = getVisionConfig();

  let dataUrl: string;
  try {
    const buf = await fs.readFile(imagePath);
    const mime = mimeFromExt(imagePath);
    dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }

  for (const model of config.models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const content = await callVisionModel(
        config,
        model,
        dataUrl,
        controller.signal
      );
      if (!content) continue;

      const parsed = extractJsonFromContent(content);
      if (!parsed) continue;

      visionSupported = true;
      return {
        text: parsed.text,
        formulas: parsed.formulas,
        fullText: parsed.text,
        source: "llm-vision",
      };
    } catch {
      // Abort (timeout), network error, or bad response — try the next model.
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  // All models failed for this call. Only record a negative capability result
  // on the very first probe so a later transient failure cannot permanently
  // disable vision after it was confirmed working.
  if (visionSupported === null) {
    visionSupported = false;
  }
  return null;
}

// Tier 2: Tesseract.js fallback (server-side). Limited formula support,
// so formulas is always an empty array here.
async function runTesseractOCR(imagePath: string): Promise<OCRResult | null> {
  try {
    const result = await Tesseract.recognize(imagePath, "chi_sim+eng");
    const text = (result?.data?.text ?? "").trim();
    if (text.length < MIN_TESSERACT_TEXT_LENGTH) return null;
    return {
      text,
      formulas: [],
      fullText: text,
      source: "tesseract",
    };
  } catch {
    return null;
  }
}

// Tier 3: manual input fallback — returns an empty result the caller can
// surface as a prompt for the user to type the question by hand.
function manualResult(): OCRResult {
  return { text: "", formulas: [], fullText: "", source: "manual" };
}

export async function runOCRPipeline(imageUrl: string): Promise<OCRResult> {
  const imagePath = resolveImagePath(imageUrl);

  // Tier 1: LLM Vision — skipped once vision is known to be unavailable.
  if (visionSupported !== false) {
    const visionResult = await runLLMVisionOCR(imagePath);
    if (visionResult) return visionResult;
  }

  // Tier 2: Tesseract.js.
  const tesseractResult = await runTesseractOCR(imagePath);
  if (tesseractResult) return tesseractResult;

  // Tier 3: manual input.
  return manualResult();
}
