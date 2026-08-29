"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";

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

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "new", label: "新" },
  { value: "learning", label: "学习中" },
  { value: "review", label: "复习中" },
  { value: "relearning", label: "重新学习" },
  { value: "mastered", label: "已掌握" },
];

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MistakesListPage() {
  const [kpIdInput, setKpIdInput] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");

  const kpId =
    kpIdInput.trim() !== "" && /^\d+$/.test(kpIdInput.trim())
      ? kpIdInput.trim()
      : "";

  const query = useInfiniteQuery<
    MistakesPage,
    Error,
    InfiniteData<MistakesPage>,
    readonly unknown[],
    number
  >({
    queryKey: ["mistakes", kpId, status],
    queryFn: async ({
      pageParam,
    }: {
      pageParam: number;
    }): Promise<MistakesPage> => {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("limit", "10");
      if (kpId) params.set("kpId", kpId);
      if (status) params.set("status", status);
      const res = await fetch(`/api/mistakes?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`请求失败：${res.status}`);
      }
      return (await res.json()) as MistakesPage;
    },
    initialPageParam: 1,
    getNextPageParam: (
      lastPage: MistakesPage,
      allPages: MistakesPage[]
    ): number | undefined => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length + 1;
    },
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasNext = query.hasNextPage;
  const isFetching = query.isFetching;
  const fetchNextPage = query.fetchNextPage;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNext) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetching) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNext, isFetching, fetchNextPage]);

  const allItems: MistakeItem[] =
    query.data?.pages.flatMap((p) => p.items) ?? [];

  const filteredItems = date
    ? allItems.filter((it) => formatDate(it.created_at) === date)
    : allItems;

  const totalLoaded = allItems.length;
  const totalCount = query.data?.pages[0]?.total ?? 0;
  const isEmpty = !query.isLoading && totalLoaded === 0;
  const hasFilters = kpId !== "" || status !== "" || date !== "";

  function resetFilters() {
    setKpIdInput("");
    setStatus("");
    setDate("");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">错题本</h1>
        <Link
          href="/mistakes/upload"
          className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          上传错题
        </Link>
      </div>

      <FilterBar
        kpIdInput={kpIdInput}
        setKpIdInput={setKpIdInput}
        status={status}
        setStatus={setStatus}
        date={date}
        setDate={setDate}
        onReset={resetFilters}
      />

      {query.isLoading ? (
        <p className="animate-pulse py-12 text-center text-gray-400">
          加载中...
        </p>
      ) : query.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{query.error instanceof Error ? query.error.message : "加载失败"}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 min-h-[44px] rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
          >
            重试
          </button>
        </div>
      ) : isEmpty ? (
        <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">
            共 {totalCount} 条错题{date ? `（当前按日期筛选显示 ${filteredItems.length} 条）` : ""}
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <MistakeCard item={item} />
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} className="h-1" />
          {hasNext && isFetching ? (
            <p className="animate-pulse py-6 text-center text-sm text-gray-400">
              加载更多...
            </p>
          ) : null}
          {!hasNext && totalLoaded > 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              已加载全部错题
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}

function FilterBar({
  kpIdInput,
  setKpIdInput,
  status,
  setStatus,
  date,
  setDate,
  onReset,
}: {
  kpIdInput: string;
  setKpIdInput: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex sm:flex-wrap sm:items-end sm:gap-4 sm:space-y-0">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          知识点 ID
        </label>
        <input
          type="number"
          min={1}
          value={kpIdInput}
          onChange={(e) => setKpIdInput(e.target.value)}
          placeholder="可选"
          className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          掌握状态
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          日期
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button
        type="button"
        onClick={onReset}
        className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 hover:bg-gray-100"
      >
        重置
      </button>
    </div>
  );
}

function MistakeCard({ item }: { item: MistakeItem }) {
  const errorType = item.error_cause?.type ?? "";
  const mastery = item.mastery_state ?? "new";
  const errorLabel = ERROR_TYPE_LABEL[errorType] ?? (errorType || "未分析");
  const errorClass = ERROR_TYPE_CLASS[errorType] ?? "bg-gray-100 text-gray-800";
  const masteryLabel = MASTERY_LABEL[mastery] ?? mastery;
  const masteryClass = MASTERY_CLASS[mastery] ?? MASTERY_CLASS.new;
  const preview =
    item.question_text?.trim() ||
    item.ocr_text?.trim() ||
    "（无题目文字）";

  return (
    <Link
      href={`/mistakes/${item.id}`}
      className="flex h-full gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt="错题缩略图"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
            无图
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${errorClass}`}
          >
            {errorLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${masteryClass}`}
          >
            {masteryLabel}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-gray-700">{preview}</p>
        <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
          <span className="truncate">
            {item.kp_title ? `知识点：${item.kp_title}` : "知识点：未关联"}
          </span>
          <span>{formatDate(item.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({
  hasFilters,
  onReset,
}: {
  hasFilters: boolean;
  onReset: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
        <p className="text-sm text-gray-500">没有符合筛选条件的错题</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-3 min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50"
        >
          清除筛选
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
      <p className="text-sm text-gray-500">
        还没有错题记录，去上传一道试试
      </p>
      <Link
        href="/mistakes/upload"
        className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700"
      >
        上传错题
      </Link>
    </div>
  );
}
