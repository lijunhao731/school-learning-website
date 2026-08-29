"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface MistakeItem {
  id: number;
  kp_id: number | null;
  image_url: string | null;
  ocr_text: string | null;
  question_text: string | null;
  student_answer: string | null;
  error_cause: { type: string; description: string } | null;
  solution_approach: unknown;
  related_kp_ids: string[] | null;
  created_at: string | null;
  mastery_state: string | null;
  kp_title: string | null;
}

interface MistakesPage {
  items: MistakeItem[];
  total: number;
  hasMore: boolean;
}

interface SolutionStep {
  step: number;
  explanation: string;
}

const ERROR_TYPE_LABEL: Record<string, string> = {
  conceptual: "概念性错误",
  procedural: "程序性错误",
  computational: "计算错误",
  careless: "粗心错误",
};

const ERROR_TYPE_CLASS: Record<string, string> = {
  conceptual: "bg-blue-100 text-blue-800",
  procedural: "bg-purple-100 text-purple-800",
  computational: "bg-orange-100 text-orange-800",
  careless: "bg-gray-100 text-gray-800",
};

const MASTERY_LABEL: Record<string, string> = {
  new: "新",
  learning: "学习中",
  review: "复习中",
  relearning: "重新学习",
  mastered: "已掌握",
};

const MASTERY_CLASS: Record<string, string> = {
  new: "bg-gray-100 text-gray-800",
  learning: "bg-yellow-100 text-yellow-800",
  review: "bg-blue-100 text-blue-800",
  relearning: "bg-red-100 text-red-800",
  mastered: "bg-green-100 text-green-800",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MistakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = rawId ? Number(rawId) : NaN;
  const mistakeId = Number.isInteger(id) && id > 0 ? id : null;

  const query = useQuery<MistakesPage>({
    queryKey: ["mistakes", "detail", mistakeId],
    enabled: mistakeId !== null,
    queryFn: async (): Promise<MistakesPage> => {
      const res = await fetch(`/api/mistakes?limit=100&page=1`);
      if (!res.ok) {
        throw new Error(`请求失败：${res.status}`);
      }
      return (await res.json()) as MistakesPage;
    },
  });

  if (mistakeId === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BackButton onClick={() => router.back()} />
        <p className="py-12 text-center text-gray-500">无效的错题 ID</p>
      </main>
    );
  }

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BackButton onClick={() => router.back()} />
        <p className="animate-pulse py-12 text-center text-gray-400">
          加载中...
        </p>
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BackButton onClick={() => router.back()} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>
            {query.error instanceof Error ? query.error.message : "加载失败"}
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 min-h-[44px] rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  const mistake =
    query.data?.items.find((m: MistakeItem): boolean => m.id === mistakeId) ??
    null;

  if (!mistake) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BackButton onClick={() => router.back()} />
        <p className="py-12 text-center text-gray-500">
          未找到该错题，可能已不在最近 100 条记录中。
        </p>
      </main>
    );
  }

  const errorType = mistake.error_cause?.type ?? "";
  const mastery = mistake.mastery_state ?? "new";
  const steps = parseSolutionSteps(mistake.solution_approach);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <BackButton onClick={() => router.back()} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {errorType ? (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              ERROR_TYPE_CLASS[errorType] ?? "bg-gray-100 text-gray-800"
            }`}
          >
            {ERROR_TYPE_LABEL[errorType] ?? errorType}
          </span>
        ) : null}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            MASTERY_CLASS[mastery] ?? MASTERY_CLASS.new
          }`}
        >
          {MASTERY_LABEL[mastery] ?? mastery}
        </span>
        {mistake.kp_title ? (
          <span className="text-xs text-gray-500">
            知识点：{mistake.kp_title}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-gray-500">
          {formatDate(mistake.created_at)}
        </span>
      </div>

      {mistake.image_url ? (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900">原始图片</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mistake.image_url}
            alt="错题原图"
            className="w-full rounded-lg border border-gray-200"
          />
        </section>
      ) : null}

      {mistake.question_text ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900">题目</h2>
          <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-800">
            {mistake.question_text}
          </p>
        </section>
      ) : null}

      {mistake.student_answer ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900">学生答案</h2>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-gray-800">
            {mistake.student_answer}
          </p>
        </section>
      ) : null}

      {mistake.ocr_text ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900">OCR 文本</h2>
          <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {mistake.ocr_text}
          </p>
        </section>
      ) : null}

      {mistake.error_cause ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900">错误分析</h2>
          <div className="space-y-2 rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium">类型：</span>
              {ERROR_TYPE_LABEL[errorType] ?? errorType}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">说明：</span>
              {mistake.error_cause.description}
            </p>
          </div>
        </section>
      ) : null}

      {steps.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900">解题思路</h2>
          <ol className="space-y-2">
            {steps.map((s: SolutionStep, i: number) => (
              <li
                key={i}
                className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700"
              >
                <span className="font-medium text-gray-900">
                  步骤 {s.step}：
                </span>
                {s.explanation}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {mistake.related_kp_ids && mistake.related_kp_ids.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900">关联知识点</h2>
          <div className="flex flex-wrap gap-2">
            {mistake.related_kp_ids.map((kp: string, i: number) => {
              const isNumeric = /^\d+$/.test(kp);
              if (isNumeric) {
                return (
                  <Link
                    key={i}
                    href={`/knowledge/${kp}`}
                    className="min-h-[36px] rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
                  >
                    {kp}
                  </Link>
                );
              }
              return (
                <span
                  key={i}
                  className="min-h-[36px] rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600"
                >
                  {kp}
                </span>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-bold text-gray-900">掌握状态</h2>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 p-4">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              MASTERY_CLASS[mastery] ?? MASTERY_CLASS.new
            }`}
          >
            {MASTERY_LABEL[mastery] ?? mastery}
          </span>
          <span className="text-sm text-gray-600">
            {mastery === "mastered"
              ? "该知识点已掌握"
              : "该知识点仍在复习周期中"}
          </span>
        </div>
      </section>
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50"
    >
      ← 返回
    </button>
  );
}

function parseSolutionSteps(value: unknown): SolutionStep[] {
  if (!Array.isArray(value)) return [];
  const steps: SolutionStep[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { step?: unknown }).step === "number" &&
      typeof (entry as { explanation?: unknown }).explanation === "string"
    ) {
      steps.push({
        step: (entry as { step: number }).step,
        explanation: (entry as { explanation: string }).explanation,
      });
    }
  }
  return steps;
}
