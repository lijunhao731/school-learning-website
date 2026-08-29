"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── API response shapes ──────────────────────────────────────────────────────

interface SessionChoice {
  text: string;
  isCorrect: boolean;
}

interface SessionItem {
  kpId: number;
  reviewItemId: number;
  quizAttemptId: number;
  question: string;
  choices: SessionChoice[];
  explanation: string;
  targetsKp: string;
}

interface SessionResponse {
  sessionId: string;
  items: SessionItem[];
}

interface AnswerResponse {
  correct: boolean;
  explanation: string;
  masteryState: string;
  isMastered: boolean;
}

// ── Session state ─────────────────────────────────────────────────────────────

interface AnswerResult {
  correct: boolean;
  explanation: string;
  masteryState: string;
  isMastered: boolean;
}

interface SessionState {
  sessionId: string | null;
  items: SessionItem[];
  currentIndex: number;
  answers: Record<number, number>; // questionIndex → selectedIndex
  results: Record<number, AnswerResult>;
  summary: { total: number; correct: number; mastered: number } | null;
}

type LoadStatus = "loading" | "ready" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MASTERY_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: "新", className: "bg-gray-100 text-gray-600" },
  learning: { label: "学习中", className: "bg-yellow-100 text-yellow-700" },
  review: { label: "复习中", className: "bg-blue-100 text-blue-700" },
  relearning: { label: "重新学习", className: "bg-red-100 text-red-700" },
  mastered: { label: "已掌握", className: "bg-green-100 text-green-700" },
};

function choiceLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Detect a mastery-confirmation gate item. The review session API may flag
 * gate items via the `targetsKp` field (e.g. containing "mastery") or, in the
 * future, an explicit marker. Gate items cannot be skipped.
 */
function isMasteryGateItem(item: SessionItem): boolean {
  return item.targetsKp.toLowerCase().includes("mastery");
}

function MasteryBadge({ state }: { state: string }) {
  const badge = MASTERY_BADGE[state] ?? {
    label: state,
    className: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewSession() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    items: [],
    currentIndex: 0,
    answers: {},
    results: {},
    summary: null,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load the review session on mount (and on retry).
  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    setLoadError(null);
    (async () => {
      try {
        const res = await fetch("/api/review/session");
        if (!res.ok) throw new Error(`请求失败：${res.status}`);
        const data = (await res.json()) as SessionResponse;
        if (cancelled) return;
        setState({
          sessionId: data.sessionId,
          items: data.items,
          currentIndex: 0,
          answers: {},
          results: {},
          summary: null,
        });
        setSelected(null);
        setLoadStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "加载失败");
        setLoadStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const total = state.items.length;
  const current = state.items[state.currentIndex];
  const result =
    state.currentIndex in state.results ? state.results[state.currentIndex] : null;
  const answered = result !== null;
  const isLast = state.currentIndex === total - 1;
  const answeredCount = Object.keys(state.results).length;

  // Reset transient per-question state when the question changes.
  useEffect(() => {
    setSelected(null);
    setSubmitError(null);
  }, [state.currentIndex]);

  const handleSubmit = async () => {
    if (selected === null || !current || !state.sessionId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `/api/review/session/${state.sessionId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizAttemptId: current.quizAttemptId,
            answer: selected,
            reviewItemId: current.reviewItemId,
          }),
        }
      );
      if (!res.ok) throw new Error(`提交失败：${res.status}`);
      const data = (await res.json()) as AnswerResponse;
      setState((s) => ({
        ...s,
        answers: { ...s.answers, [s.currentIndex]: selected },
        results: {
          ...s.results,
          [s.currentIndex]: {
            correct: data.correct,
            explanation: data.explanation,
            masteryState: data.masteryState,
            isMastered: data.isMastered,
          },
        },
      }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setState((s) => {
      const nextIndex = s.currentIndex + 1;
      if (nextIndex >= s.items.length) {
        const correctCount = Object.values(s.results).filter(
          (r) => r.correct
        ).length;
        const masteredCount = Object.values(s.results).filter(
          (r) => r.isMastered
        ).length;
        return {
          ...s,
          summary: {
            total: s.items.length,
            correct: correctCount,
            mastered: masteredCount,
          },
        };
      }
      return { ...s, currentIndex: nextIndex };
    });
  };

  // ── Loading / error / empty / summary states ───────────────────────────────

  if (loadStatus === "loading") {
    return <p className="animate-pulse text-gray-400">加载复习内容中...</p>;
  }

  if (loadStatus === "error") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-500">{loadError ?? "加载失败"}</p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          重试
        </button>
      </div>
    );
  }

  if (state.summary) {
    const { total: t, correct, mastered } = state.summary;
    return (
      <div className="space-y-6">
        <div className="space-y-3 rounded-lg border p-6 text-center">
          <p className="text-lg font-bold text-gray-900">复习完成</p>
          <div className="grid grid-cols-3 gap-3">
            <SummaryStat label="复习知识点" value={t} />
            <SummaryStat label="答对" value={correct} />
            <SummaryStat label="新掌握" value={mastered} />
          </div>
        </div>
        <Link
          href="/"
          className="inline-block rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="space-y-4 rounded-lg border p-6 text-center">
        <p className="text-gray-900">暂无到期复习，做得好！</p>
        <Link
          href="/"
          className="inline-block rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (!current) {
    return null;
  }

  // ── Active question ────────────────────────────────────────────────────────

  const correctIndex = current.choices.findIndex((c) => c.isCorrect);
  const userChoice = answered ? state.answers[state.currentIndex] : selected;
  const position = Math.min(state.currentIndex + 1, total);
  const progressPct = total > 0 ? (answeredCount / total) * 100 : 0;
  const gateItem = isMasteryGateItem(current);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            第 {position} / {total} 题
          </span>
          <span>{answeredCount} 已答</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="space-y-4 rounded-lg border p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{current.targetsKp}</span>
          {answered && result ? (
            <MasteryBadge state={result.masteryState} />
          ) : null}
        </div>

        <p className="text-gray-900">{current.question}</p>

        {gateItem ? (
          <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">
            ⚠️ 掌握度测试：需全部答对才能确认掌握
          </p>
        ) : null}

        <div className="space-y-2">
          {current.choices.map((choice, index) => {
            let className =
              "w-full text-left p-3 border rounded-lg transition-colors ";
            if (!answered) {
              if (selected === index) {
                className += "bg-blue-50 border-blue-500 ring-2 ring-blue-200";
              } else {
                className +=
                  "bg-white border-blue-200 hover:border-blue-400 hover:bg-blue-50";
              }
            } else if (index === correctIndex) {
              className += "bg-green-50 border-green-500";
            } else if (index === userChoice) {
              className += "bg-red-50 border-red-500";
            } else {
              className += "bg-white border-gray-200 opacity-60";
            }
            return (
              <button
                key={index}
                type="button"
                disabled={answered || submitting}
                onClick={() => setSelected(index)}
                className={className}
              >
                <span className="mr-2 font-medium text-gray-700">
                  {choiceLabel(index)}.
                </span>
                {choice.text}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {answered && result ? (
          <div className="space-y-2 border-t pt-4">
            <p
              className={`text-sm font-medium ${
                result.correct ? "text-green-600" : "text-red-600"
              }`}
            >
              {result.correct ? "回答正确" : "回答错误"}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">解析：</span>
              {result.explanation}
            </p>
          </div>
        ) : null}

        {submitError ? (
          <p className="text-sm text-red-500">{submitError}</p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        {answered ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {isLast ? "查看总结" : "下一题"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selected === null || submitting}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "提交中..." : "提交"}
          </button>
        )}
      </div>
    </div>
  );
}
