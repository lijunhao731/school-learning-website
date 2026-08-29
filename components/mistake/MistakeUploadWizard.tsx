"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoUpload } from "@/components/mistake/PhotoUpload";
import {
  useMistakeWizardStore,
  type WizardStep,
} from "@/lib/stores/mistake-wizard-store";
import type { ErrorAnalysis } from "@/lib/prompts/error-analysis";
import type { SimilarQuestions } from "@/lib/prompts/similar-questions";

type SimilarQuestion = SimilarQuestions["questions"][number];

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "photo", label: "拍照" },
  { key: "ocr", label: "识别" },
  { key: "analysis", label: "分析" },
  { key: "quiz", label: "练习" },
  { key: "summary", label: "完成" },
];

const ERROR_TYPE_LABEL: Record<
  ErrorAnalysis["errorCause"]["type"],
  string
> = {
  conceptual: "概念性错误",
  procedural: "程序性错误",
  computational: "计算错误",
  careless: "粗心错误",
};

const DIFFICULTY_LABEL: Record<ErrorAnalysis["difficulty"], string> = {
  easy: "简单",
  medium: "中等",
  hard: "较难",
};

const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F"];

export function MistakeUploadWizard() {
  const step = useMistakeWizardStore((s) => s.step);
  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} currentIndex={currentIndex} />
      {step === "photo" && <PhotoStep />}
      {step === "ocr" && <OcrStep />}
      {step === "analysis" && <AnalysisStep />}
      {step === "quiz" && <QuizStep />}
      {step === "summary" && <SummaryStep />}
    </div>
  );
}

/* ----------------------------- Stepper ----------------------------- */

function Stepper({
  steps,
  currentIndex,
}: {
  steps: { key: WizardStep; label: string }[];
  currentIndex: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        {steps.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const circleClass = active
            ? "border-blue-600 bg-blue-600 text-white"
            : done
              ? "border-green-500 bg-green-500 text-white"
              : "border-gray-300 bg-white text-gray-500";
          const labelClass = active
            ? "font-medium text-blue-600"
            : "text-gray-500";
          return (
            <div
              key={s.key}
              className="flex flex-1 flex-col items-center text-center"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${circleClass}`}
              >
                {i + 1}
              </div>
              <span className={`mt-1 text-xs ${labelClass}`}>{s.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm text-gray-500">
        第 {currentIndex + 1}/{steps.length} 步
      </p>
    </div>
  );
}

/* ----------------------------- Step 1: Photo ----------------------------- */

function PhotoStep() {
  const setImageUrl = useMistakeWizardStore((s) => s.setImageUrl);
  const setStep = useMistakeWizardStore((s) => s.setStep);
  const setError = useMistakeWizardStore((s) => s.setError);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        拍摄或选择错题照片，上传成功后自动进入识别。
      </p>
      <PhotoUpload
        onUploaded={(url) => {
          setImageUrl(url);
          setError(null);
          setStep("ocr");
        }}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}

/* ----------------------------- Step 2: OCR ----------------------------- */

interface OcrResponse {
  text: string;
  formulas: { latex: string }[];
  fullText: string;
  source: string;
}

function OcrStep() {
  const imageUrl = useMistakeWizardStore((s) => s.imageUrl);
  const ocrText = useMistakeWizardStore((s) => s.ocrText);
  const ocrFormulas = useMistakeWizardStore((s) => s.ocrFormulas);
  const ocrSource = useMistakeWizardStore((s) => s.ocrSource);
  const loading = useMistakeWizardStore((s) => s.loading);
  const error = useMistakeWizardStore((s) => s.error);
  const setOcrResult = useMistakeWizardStore((s) => s.setOcrResult);
  const setOcrText = useMistakeWizardStore((s) => s.setOcrText);
  const setLoading = useMistakeWizardStore((s) => s.setLoading);
  const setError = useMistakeWizardStore((s) => s.setError);
  const setStep = useMistakeWizardStore((s) => s.setStep);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (!imageUrl) return;
    if (ocrText || ocrSource || loading) return;
    fetchedRef.current = true;
    void runOcr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  async function runOcr() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = (await res.json().catch(() => null)) as
        | OcrResponse
        | { error?: string }
        | null;
      if (!res.ok) {
        const msg =
          data && "error" in data && data.error
            ? data.error
            : `识别失败 (${res.status})`;
        throw new Error(msg);
      }
      const result = data as OcrResponse;
      setOcrResult(
        result.text || result.fullText || "",
        result.formulas ?? [],
        result.source ?? ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "识别失败");
    } finally {
      setLoading(false);
    }
  }

  const isManual = ocrSource === "manual";
  const canConfirm = ocrText.trim().length > 0 && !loading;

  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border p-6 text-center">
        <p className="text-gray-700">识别中…</p>
        <div className="mx-auto h-2 w-48 overflow-hidden rounded bg-gray-200">
          <div className="h-full w-1/3 animate-pulse bg-blue-500" />
        </div>
        <p className="text-sm text-gray-500">正在调用 OCR 服务识别题目</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              fetchedRef.current = false;
              void runOcr();
            }}
            className="mt-2 min-h-[44px] rounded bg-red-600 px-4 text-sm text-white hover:bg-red-700"
          >
            重新识别
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          题目文字
        </label>
        {isManual ? (
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
            未能自动识别题目，请手动输入题目文字后确认。
          </p>
        ) : null}
        <textarea
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          rows={6}
          placeholder="识别到的题目文字将显示在这里，可编辑修正"
          className="min-h-[120px] w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {ocrFormulas.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">识别到的公式</p>
          <ul className="space-y-1">
            {ocrFormulas.map((f, i) => (
              <li
                key={i}
                className="rounded bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800"
              >
                {f.latex}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {ocrSource ? `识别来源：${ocrSource}` : ""}
        </span>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => setStep("analysis")}
          className="min-h-[44px] rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          确认
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Step 3: Analysis ----------------------------- */

function AnalysisStep() {
  const ocrText = useMistakeWizardStore((s) => s.ocrText);
  const ocrFormulas = useMistakeWizardStore((s) => s.ocrFormulas);
  const imageUrl = useMistakeWizardStore((s) => s.imageUrl);
  const studentAnswer = useMistakeWizardStore((s) => s.studentAnswer);
  const setStudentAnswer = useMistakeWizardStore((s) => s.setStudentAnswer);
  const errorAnalysis = useMistakeWizardStore((s) => s.errorAnalysis);
  const mistakeId = useMistakeWizardStore((s) => s.mistakeId);
  const loading = useMistakeWizardStore((s) => s.loading);
  const error = useMistakeWizardStore((s) => s.error);
  const setErrorAnalysis = useMistakeWizardStore((s) => s.setErrorAnalysis);
  const setMistakeId = useMistakeWizardStore((s) => s.setMistakeId);
  const setLoading = useMistakeWizardStore((s) => s.setLoading);
  const setError = useMistakeWizardStore((s) => s.setError);
  const setStep = useMistakeWizardStore((s) => s.setStep);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mistakes/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocrText,
          ocrFormulas,
          studentAnswer,
          imageUrl,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (ErrorAnalysis & { mistakeId?: number | null })
        | { error?: string }
        | null;
      if (!res.ok) {
        const msg =
          data && "error" in data && data.error
            ? data.error
            : `分析失败 (${res.status})`;
        throw new Error(msg);
      }
      const result = data as ErrorAnalysis & {
        mistakeId?: number | null;
      };
      setErrorAnalysis(result);
      if (result.mistakeId != null) {
        setMistakeId(result.mistakeId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          你的答案（可选）
        </label>
        <textarea
          value={studentAnswer}
          onChange={(e) => setStudentAnswer(e.target.value)}
          rows={3}
          placeholder="填写你当时给出的答案，有助于更精准地分析错误原因"
          className="min-h-[80px] w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {!errorAnalysis ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void runAnalysis()}
          className="min-h-[44px] w-full rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? "分析中…" : "开始分析"}
        </button>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void runAnalysis()}
            className="mt-2 min-h-[44px] rounded bg-red-600 px-4 text-sm text-white hover:bg-red-700"
          >
            重试
          </button>
        </div>
      ) : null}

      {errorAnalysis ? (
        <AnalysisResult analysis={errorAnalysis} />
      ) : null}

      {errorAnalysis ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {mistakeId != null ? `错题编号：${mistakeId}` : ""}
          </span>
          <button
            type="button"
            onClick={() => setStep("quiz")}
            className="min-h-[44px] rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700"
          >
            继续
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: ErrorAnalysis }) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap gap-2">
        <Tag>
          {ERROR_TYPE_LABEL[analysis.errorCause.type] ??
            analysis.errorCause.type}
        </Tag>
        <Tag>难度：{DIFFICULTY_LABEL[analysis.difficulty] ?? analysis.difficulty}</Tag>
        {analysis.questionType ? (
          <Tag>题型：{analysis.questionType}</Tag>
        ) : null}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">错误原因</h3>
        <p className="text-sm text-gray-700">{analysis.errorCause.description}</p>
      </div>

      {analysis.solutionApproach.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">解题思路</h3>
          <ol className="space-y-2">
            {analysis.solutionApproach.map((s) => (
              <li key={s.step} className="flex gap-2 text-sm text-gray-700">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                  {s.step}
                </span>
                <span className="pt-0.5">{s.explanation}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {analysis.relatedKpIds.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-800">关联知识点</h3>
          <div className="flex flex-wrap gap-2">
            {analysis.relatedKpIds.map((kp) => (
              <span
                key={kp}
                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
              >
                {kp}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
      {children}
    </span>
  );
}

/* ----------------------------- Step 4: Quiz ----------------------------- */

function QuizStep() {
  const mistakeId = useMistakeWizardStore((s) => s.mistakeId);
  const similarQuestions = useMistakeWizardStore((s) => s.similarQuestions);
  const setSimilarQuestions = useMistakeWizardStore(
    (s) => s.setSimilarQuestions
  );
  const addQuizResult = useMistakeWizardStore((s) => s.addQuizResult);
  const quizResults = useMistakeWizardStore((s) => s.quizResults);
  const loading = useMistakeWizardStore((s) => s.loading);
  const error = useMistakeWizardStore((s) => s.error);
  const setLoading = useMistakeWizardStore((s) => s.setLoading);
  const setError = useMistakeWizardStore((s) => s.setError);
  const setStep = useMistakeWizardStore((s) => s.setStep);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (mistakeId == null) return;
    if (similarQuestions || loading) return;
    fetchedRef.current = true;
    void runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mistakeId]);

  async function runFetch() {
    if (mistakeId == null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/mistakes/${mistakeId}/similar-questions`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => null)) as
        | SimilarQuestions
        | { error?: string }
        | null;
      if (!res.ok) {
        const msg =
          data && "error" in data && data.error
            ? data.error
            : `生成相似题失败 (${res.status})`;
        throw new Error(msg);
      }
      setSimilarQuestions(data as SimilarQuestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成相似题失败");
    } finally {
      setLoading(false);
    }
  }

  if (mistakeId == null) {
    return (
      <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          错题尚未保存编号，无法生成相似练习题。请返回上一步重新分析。
        </p>
        <button
          type="button"
          onClick={() => setStep("analysis")}
          className="min-h-[44px] rounded-lg bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700"
        >
          返回分析
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border p-6 text-center">
        <p className="text-gray-700">生成相似题中…</p>
        <div className="mx-auto h-2 w-48 overflow-hidden rounded bg-gray-200">
          <div className="h-full w-1/3 animate-pulse bg-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            fetchedRef.current = false;
            void runFetch();
          }}
          className="min-h-[44px] rounded bg-red-600 px-4 text-sm text-white hover:bg-red-700"
        >
          重试
        </button>
      </div>
    );
  }

  const questions = similarQuestions?.questions ?? [];
  const answeredCount = quizResults.length;
  const allAnswered = questions.length > 0 && answeredCount >= questions.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        共 {questions.length} 道相似题，已答 {answeredCount} 道。选择答案后即显示解析。
      </p>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <SimilarQuestionCard
            key={q.id ?? i}
            question={q}
            onAnswered={(correct) => addQuizResult(q.id, correct)}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={!allAnswered}
        onClick={() => setStep("summary")}
        className="min-h-[44px] w-full rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        完成
      </button>
    </div>
  );
}

function SimilarQuestionCard({
  question,
  onAnswered,
}: {
  question: SimilarQuestion;
  onAnswered: (correct: boolean) => void;
}) {
  const isMulti = question.type === "multiple-choice";
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const correctIndices: number[] = [];
  question.choices.forEach((c, i) => {
    if (c.isCorrect) correctIndices.push(i);
  });

  const handleSelect = (i: number) => {
    if (submitted) return;
    if (isMulti) {
      setSelected((prev) =>
        prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
      );
    } else {
      setSelected([i]);
      setSubmitted(true);
      onAnswered(correctIndices.includes(i));
    }
  };

  const handleSubmit = () => {
    if (submitted || selected.length === 0) return;
    setSubmitted(true);
    const correct =
      correctIndices.length > 0 &&
      correctIndices.every((idx) => selected.includes(idx)) &&
      selected.every((idx) => correctIndices.includes(idx));
    onAnswered(correct);
  };

  const answered = submitted;

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <p className="text-gray-900">{question.question}</p>
      <div className="space-y-2">
        {question.choices.map((choice, i) => {
          let cls =
            "w-full text-left p-3 border rounded min-h-[44px]";
          if (answered) {
            if (choice.isCorrect) {
              cls += " bg-green-50 border-green-500";
            } else if (selected.includes(i)) {
              cls += " bg-red-50 border-red-500";
            }
          } else if (selected.includes(i)) {
            cls += " border-blue-500 bg-blue-50";
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(i)}
              disabled={answered}
              className={cls}
            >
              <span className="mr-2 font-medium">
                {CHOICE_LABELS[i] ?? i + 1}.
              </span>
              {choice.text}
            </button>
          );
        })}
      </div>

      {isMulti && !answered ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={selected.length === 0}
          className="min-h-[44px] rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          提交答案
        </button>
      ) : null}

      {answered ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">
            {correctIndices.every((idx) => selected.includes(idx)) &&
            selected.every((idx) => correctIndices.includes(idx))
              ? "回答正确"
              : "回答错误"}
          </p>
          <p className="text-sm text-gray-600">{question.explanation}</p>
          {question.targetsKp ? (
            <p className="text-xs text-gray-400">
              针对知识点：{question.targetsKp}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------- Step 5: Summary ----------------------------- */

function SummaryStep() {
  const similarQuestions = useMistakeWizardStore((s) => s.similarQuestions);
  const quizResults = useMistakeWizardStore((s) => s.quizResults);
  const errorAnalysis = useMistakeWizardStore((s) => s.errorAnalysis);
  const reset = useMistakeWizardStore((s) => s.reset);

  const total = similarQuestions?.questions.length ?? 0;
  const correct = quizResults.filter((r) => r.correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const plan =
    accuracy >= 80
      ? "掌握较好，建议间隔 3 天后复习一次巩固。"
      : accuracy >= 50
        ? "部分掌握，建议明天再做 1 组相似题。"
        : "仍需加强，建议今天回顾解析后再做 1 组相似题。";

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-3xl font-bold text-green-700">
          {correct}/{total}
        </p>
        <p className="text-sm text-green-700">
          正确率 {accuracy}% · 共分析 {total} 道相似题
        </p>
      </div>

      {errorAnalysis ? (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-800">本次错题</h3>
          <p className="text-sm text-gray-700">
            {ERROR_TYPE_LABEL[errorAnalysis.errorCause.type] ??
              errorAnalysis.errorCause.type}
            ，难度：
            {DIFFICULTY_LABEL[errorAnalysis.difficulty] ??
              errorAnalysis.difficulty}
          </p>
        </div>
      ) : null}

      <div className="rounded-lg bg-blue-50 p-4">
        <h3 className="mb-1 text-sm font-semibold text-blue-800">复习计划</h3>
        <p className="text-sm text-blue-700">{plan}</p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="min-h-[44px] w-full rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
      >
        再传一题
      </button>
    </div>
  );
}
