"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useKnowledgeStore } from "@/lib/stores/knowledge-store";
import { TreeSidebar } from "@/components/knowledge/TreeSidebar";
import { MobileAccordion } from "@/components/knowledge/MobileAccordion";
import { Breadcrumb } from "@/components/knowledge/Breadcrumb";
import { MCQuestion } from "@/components/quiz/MCQuestion";
import type { AllContent } from "@/lib/prompts/knowledge-content";
import type { PracticeQuiz } from "@/lib/prompts/practice-quiz";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "较难",
};

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

  // 一次性请求全部教学内容（核心概念+详细讲解+例题），缓存后秒读
  const contentQuery = useQuery<AllContent>({
    queryKey: ["kp-content", kpId],
    enabled: kpId !== null,
    queryFn: async (): Promise<AllContent> => {
      const res = await fetch(`/api/knowledge/${kpId}/content`);
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      return (await res.json()) as AllContent;
    },
  });

  // 练习题独立动态生成，仅在练习 tab 激活时加载
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

          {/* 全局加载/错误状态 */}
          {contentQuery.isLoading ? (
            <div className="py-12 text-center">
              <p className="animate-pulse text-gray-400">
                正在生成知识点内容，请稍候...
              </p>
              <p className="mt-1 text-xs text-gray-400">
                首次生成需要一些时间，生成后会自动缓存
              </p>
            </div>
          ) : contentQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{contentQuery.error instanceof Error ? contentQuery.error.message : "加载失败"}</p>
              <button
                type="button"
                onClick={() => void contentQuery.refetch()}
                className="mt-2 min-h-[44px] rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
              >
                重试
              </button>
            </div>
          ) : contentQuery.data ? (
            <>
              {/* 核心概念 */}
              {activeTab === "intro" && (
                <section className="whitespace-pre-wrap text-gray-700">
                  {contentQuery.data.intro}
                </section>
              )}

              {/* 详细讲解 */}
              {activeTab === "detail" && (
                <section className="whitespace-pre-wrap text-gray-700">
                  {contentQuery.data.detail}
                </section>
              )}

              {/* 例题 */}
              {activeTab === "examples" && (
                <section className="space-y-4">
                  {(contentQuery.data.examples ?? []).length === 0 ? (
                    <p className="text-gray-500">暂无例题</p>
                  ) : (
                    contentQuery.data.examples.map((ex, i) => (
                      <div key={i} className="space-y-2 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            例 {i + 1}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {DIFFICULTY_LABEL[ex.difficulty] ?? ex.difficulty}
                          </span>
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
                    ))
                  )}
                </section>
              )}
            </>
          ) : null}

          {/* 练习（独立加载） */}
          {activeTab === "practice" && (
            <section className="space-y-4">
              {practiceQuery.isLoading ? (
                <div className="py-8 text-center">
                  <p className="animate-pulse text-gray-400">
                    正在生成练习题，请稍候...
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    首次生成需要一些时间，生成后会自动缓存
                  </p>
                </div>
              ) : practiceQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p>练习题加载失败</p>
                  <button
                    type="button"
                    onClick={() => void practiceQuery.refetch()}
                    className="mt-2 min-h-[44px] rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
                  >
                    重试
                  </button>
                </div>
              ) : (practiceQuery.data?.questions ?? []).length === 0 ? (
                <p className="text-gray-500">暂无练习题</p>
              ) : (
                (practiceQuery.data?.questions ?? []).map((q, i) => (
                  <MCQuestion key={q.id ?? i} question={q} />
                ))
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
