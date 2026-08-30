"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useKnowledgeStore } from "@/lib/stores/knowledge-store";
import { TreeSidebar } from "@/components/knowledge/TreeSidebar";
import { MobileAccordion } from "@/components/knowledge/MobileAccordion";
import { Breadcrumb } from "@/components/knowledge/Breadcrumb";
import { MCQuestion } from "@/components/quiz/MCQuestion";
import type { ExampleProblems } from "@/lib/prompts/example-problems";
import type { PracticeQuiz } from "@/lib/prompts/practice-quiz";

type StreamStatus = "idle" | "loading" | "streaming" | "done" | "error";

function useTextStream(url: string | null) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = () => {
    setText("");
    setError(null);
    setStatus("idle");
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    setStatus("loading");
    setText("");

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok || !res.body) {
          throw new Error(`请求失败：${res.status}`);
        }
        setStatus("streaming");
        reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            acc += decoder.decode(value, { stream: true });
            setText(acc);
          }
        }
        acc += decoder.decode();
        setText(acc);
        setStatus("done");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      } finally {
        if (reader) {
          try {
            reader.releaseLock();
          } catch {
            // ignore
          }
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [url, retryCount]);

  return { text, status, error, retry };
}

function StreamBlock({
  status,
  text,
  error,
  onRetry,
}: {
  status: StreamStatus;
  text: string;
  error: Error | null;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-500">{error?.message ?? "加载失败"}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          重试
        </button>
      </div>
    );
  }
  if (status === "idle" || status === "loading" || !text) {
    return <p className="animate-pulse text-gray-400">加载中...</p>;
  }
  return (
    <div className="whitespace-pre-wrap text-gray-700">{text}</div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
    >
      重试
    </button>
  );
}

function ExamplesBlock({ query }: { query: UseQueryResult<ExampleProblems> }) {
  if (query.isLoading) {
    return <p className="animate-pulse text-gray-400">加载中...</p>;
  }
  if (query.error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-500">例题加载失败</p>
        <RetryButton onClick={() => void query.refetch()} />
      </div>
    );
  }
  const examples = query.data?.examples ?? [];
  if (examples.length === 0) {
    return <p className="text-gray-500">暂无例题</p>;
  }
  return (
    <div className="space-y-4">
      {examples.map((ex, i) => (
        <div key={i} className="space-y-2 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              例 {i + 1}
            </span>
            <span className="text-xs text-gray-500">{ex.difficulty}</span>
          </div>
          <p className="text-gray-900">{ex.question}</p>
          <div className="whitespace-pre-wrap text-sm text-gray-700">
            <span className="font-medium">解答：</span>
            {ex.solution}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">解析：</span>
            {ex.explanation}
          </div>
        </div>
      ))}
    </div>
  );
}

function PracticeBlock({ query }: { query: UseQueryResult<PracticeQuiz> }) {
  if (query.isLoading) {
    return <p className="animate-pulse text-gray-400">加载中...</p>;
  }
  if (query.error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-500">练习加载失败</p>
        <RetryButton onClick={() => void query.refetch()} />
      </div>
    );
  }
  const questions = query.data?.questions ?? [];
  if (questions.length === 0) {
    return <p className="text-gray-500">暂无练习题</p>;
  }
  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <MCQuestion key={q.id ?? i} question={q} />
      ))}
    </div>
  );
}

export default function KnowledgeDetailPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = rawId ? Number(rawId) : NaN;
  const kpId = Number.isInteger(id) && id > 0 ? id : null;

  const setSelectedKpId = useKnowledgeStore((s) => s.setSelectedKpId);

  useEffect(() => {
    setSelectedKpId(kpId);
  }, [kpId, setSelectedKpId]);

  const [activeTab, setActiveTab] = useState<"intro" | "detail" | "examples" | "practice">("intro");

  const introUrl = kpId !== null ? `/api/knowledge/${kpId}/intro` : null;
  // detail 只在对应 tab 激活时才请求，避免一进页面就拉取全部内容
  const detailUrl = kpId !== null && activeTab === "detail" ? `/api/knowledge/${kpId}/detail` : null;

  const intro = useTextStream(introUrl);
  const detail = useTextStream(detailUrl);

  const examplesQuery = useQuery<ExampleProblems>({
    queryKey: ["examples", kpId],
    enabled: kpId !== null && activeTab === "examples",
    queryFn: async (): Promise<ExampleProblems> => {
      const res = await fetch(`/api/knowledge/${kpId}/examples`);
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      return (await res.json()) as ExampleProblems;
    },
  });

  const practiceQuery = useQuery<PracticeQuiz>({
    queryKey: ["practice", kpId],
    enabled: kpId !== null && activeTab === "practice",
    queryFn: async (): Promise<PracticeQuiz> => {
      const res = await fetch(`/api/knowledge/${kpId}/practice`);
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      return (await res.json()) as PracticeQuiz;
    },
  });

  if (kpId === null) {
    return (
      <div className="flex">
        <TreeSidebar />
        <main className="p-4 text-gray-500 lg:p-6">无效的知识点 ID</main>
      </div>
    );
  }

  const TABS = [
    { key: "intro" as const, label: "核心概念" },
    { key: "detail" as const, label: "详细讲解" },
    { key: "examples" as const, label: "例题" },
    { key: "practice" as const, label: "练习" },
  ];

  return (
    <div className="flex">
      <TreeSidebar />
      <div className="min-w-0 flex-1">
        <MobileAccordion />
        <main className="p-4 lg:p-6">
          <Breadcrumb kpId={kpId} />

          {/* Tab 导航 */}
          <div className="sticky top-0 z-10 -mx-4 mb-4 flex gap-1 border-b border-gray-200 bg-white px-4 lg:-mx-6 lg:px-6">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative whitespace-nowrap py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {activeTab === tab.key ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />
                ) : null}
              </button>
            ))}
          </div>

          {/* Tab 内容 */}
          {activeTab === "intro" && (
            <section>
              <StreamBlock
                status={intro.status}
                text={intro.text}
                error={intro.error}
                onRetry={intro.retry}
              />
            </section>
          )}

          {activeTab === "detail" && (
            <section>
              <StreamBlock
                status={detail.status}
                text={detail.text}
                error={detail.error}
                onRetry={detail.retry}
              />
            </section>
          )}

          {activeTab === "examples" && (
            <section>
              <ExamplesBlock query={examplesQuery} />
            </section>
          )}

          {activeTab === "practice" && (
            <section>
              <PracticeBlock query={practiceQuery} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
