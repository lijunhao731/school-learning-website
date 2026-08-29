"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

interface DashboardData {
  dueCount: number;
  masteryStats: {
    new: number;
    learning: number;
    review: number;
    relearning: number;
    mastered: number;
  };
  recentMistakes: Array<{
    id: number;
    kpId: number | null;
    imageUrl: string | null;
    errorCause: { type: string; description: string } | null;
    createdAt: string;
  }>;
  totalKps: number;
}

const MASTERY_META: Record<
  string,
  { label: string; bar: string; badge: string }
> = {
  new: {
    label: "新",
    bar: "bg-gray-400",
    badge: "bg-gray-100 text-gray-800",
  },
  learning: {
    label: "学习中",
    bar: "bg-yellow-500",
    badge: "bg-yellow-100 text-yellow-800",
  },
  review: {
    label: "复习中",
    bar: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800",
  },
  relearning: {
    label: "重新学习",
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-800",
  },
  mastered: {
    label: "已掌握",
    bar: "bg-green-500",
    badge: "bg-green-100 text-green-800",
  },
};

const MASTERY_ORDER = ["new", "learning", "review", "relearning", "mastered"];

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

function formatDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () =>
      fetch("/api/dashboard").then((r) => {
        if (!r.ok) throw new Error(`请求失败：${r.status}`);
        return r.json() as Promise<DashboardData>;
      }),
  });

  const isEmpty = (() => {
    if (!data) return false;
    const totalItems =
      data.masteryStats.new +
      data.masteryStats.learning +
      data.masteryStats.review +
      data.masteryStats.relearning +
      data.masteryStats.mastered;
    return totalItems === 0 && data.recentMistakes.length === 0;
  })();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">复习仪表盘</h1>
        <p className="mt-1 text-sm text-gray-500">
          今日复习进度、掌握概览与近期错题
        </p>
      </div>

      {isLoading ? (
        <p className="animate-pulse py-12 text-center text-gray-400">
          加载中...
        </p>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error instanceof Error ? error.message : "加载失败"}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 min-h-[44px] rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
          >
            重试
          </button>
        </div>
      ) : isEmpty ? (
        <EmptyState />
      ) : data ? (
        <div className="space-y-6">
          <DueCountCard dueCount={data.dueCount} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <MasteryOverview stats={data.masteryStats} />
            <div className="lg:col-span-2">
              <RecentMistakes mistakes={data.recentMistakes} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DueCountCard({ dueCount }: { dueCount: number }) {
  const hasDue = dueCount > 0;
  return (
    <section
      className={`rounded-xl border p-6 shadow-sm ${
        hasDue
          ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">今日待复习</p>
          <p
            className={`mt-1 text-5xl font-bold ${
              hasDue ? "text-blue-600" : "text-gray-900"
            }`}
          >
            {dueCount}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {hasDue ? "有道题目等待复习" : "今日没有待复习的题目"}
          </p>
        </div>
        {hasDue ? (
          <Link
            href="/review"
            className="min-h-[44px] rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            开始复习
          </Link>
        ) : (
          <Link
            href="/knowledge"
            className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            浏览知识体系
          </Link>
        )}
      </div>
    </section>
  );
}

function MasteryOverview({
  stats,
}: {
  stats: DashboardData["masteryStats"];
}) {
  const total =
    stats.new +
    stats.learning +
    stats.review +
    stats.relearning +
    stats.mastered;

  const segments = MASTERY_ORDER.map((key) => {
    const count = stats[key as keyof typeof stats];
    const meta = MASTERY_META[key];
    const percent = total > 0 ? (count / total) * 100 : 0;
    return { key, count, meta, percent };
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">掌握概览</h2>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          还没有复习记录
        </p>
      ) : (
        <>
          {/* Stacked horizontal bar (pure CSS) */}
          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
            {segments.map(
              (seg) =>
                seg.percent > 0 && (
                  <div
                    key={seg.key}
                    className={`h-full ${seg.meta.bar}`}
                    style={{ width: `${seg.percent}%` }}
                    title={`${seg.meta.label}: ${seg.count} (${seg.percent.toFixed(1)}%)`}
                  />
                )
            )}
          </div>

          <ul className="space-y-2">
            {segments.map((seg) => {
              const percentLabel =
                total > 0 ? ((seg.count / total) * 100).toFixed(1) : "0.0";
              return (
                <li
                  key={seg.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-3 w-3 rounded-sm ${seg.meta.bar}`}
                    />
                    <span className="text-gray-700">{seg.meta.label}</span>
                  </span>
                  <span className="text-gray-600">
                    {seg.count} <span className="text-gray-400">({percentLabel}%)</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            共 {total} 个复习项
          </p>
        </>
      )}
    </section>
  );
}

function RecentMistakes({
  mistakes,
}: {
  mistakes: DashboardData["recentMistakes"];
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">近期错题</h2>
        <Link
          href="/mistakes"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          查看全部
        </Link>
      </div>

      {mistakes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">还没有错题记录</p>
          <Link
            href="/mistakes/upload"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700"
          >
            上传错题
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mistakes.map((item) => (
            <li key={item.id}>
              <RecentMistakeCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentMistakeCard({
  item,
}: {
  item: DashboardData["recentMistakes"][number];
}) {
  const errorType = item.errorCause?.type ?? "";
  const errorLabel =
    ERROR_TYPE_LABEL[errorType] ?? (errorType || "未分析");
  const errorClass =
    ERROR_TYPE_CLASS[errorType] ?? "bg-gray-100 text-gray-800";

  return (
    <Link
      href={`/mistakes/${item.id}`}
      className="flex h-full gap-3 rounded-lg border border-gray-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt="错题缩略图"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
            无图
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${errorClass}`}
        >
          {errorLabel}
        </span>
        {item.errorCause?.description ? (
          <p className="line-clamp-2 text-xs text-gray-600">
            {item.errorCause.description}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
          <span>{item.kpId ? `KP #${item.kpId}` : "未关联知识点"}</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <section className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold text-gray-900">
        欢迎使用 K12 学习平台
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
        还没有复习记录或错题。从浏览知识体系开始你的学习之旅，或者上传一道错题让系统帮你分析。
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/knowledge"
          className="min-h-[44px] rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          浏览知识体系
        </Link>
        <Link
          href="/mistakes/upload"
          className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          上传错题
        </Link>
      </div>
    </section>
  );
}
