"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TreeSidebar } from "@/components/knowledge/TreeSidebar";
import { MobileAccordion } from "@/components/knowledge/MobileAccordion";
import type { KnowledgeTreeNode } from "@/lib/db/knowledge-queries";

interface TreeResponse {
  trees: KnowledgeTreeNode[];
}

export default function KnowledgeListPage() {
  const router = useRouter();

  const { data, isLoading, error } = useQuery<TreeResponse>({
    queryKey: ["knowledgeTree"],
    queryFn: async (): Promise<TreeResponse> => {
      const res = await fetch("/api/knowledge/tree");
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      return (await res.json()) as TreeResponse;
    },
  });

  const tree = data?.trees ?? [];
  const isEmpty = !isLoading && !error && tree.length === 0;

  // 找第一个叶子节点作为默认导航目标
  function findFirstLeaf(nodes: KnowledgeTreeNode[]): KnowledgeTreeNode | null {
    for (const node of nodes) {
      if (node.children.length === 0) return node;
      const leaf = findFirstLeaf(node.children);
      if (leaf) return leaf;
    }
    return null;
  }

  return (
    <div className="flex">
      <TreeSidebar />
      <div className="min-w-0 flex-1">
        <MobileAccordion />
        <main className="p-4 lg:p-6">
          {isLoading ? (
            <p className="text-gray-400">加载中…</p>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{error instanceof Error ? error.message : "加载失败"}</p>
            </div>
          ) : isEmpty ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
              <h2 className="text-lg font-semibold text-gray-900">
                知识体系建设中
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                知识树尚未生成。请稍后再来查看，或联系管理员初始化知识内容。
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">知识体系</h1>
                <p className="mt-1 text-sm text-gray-500">
                  从左侧知识树选择知识点开始学习，或点击下方推荐继续。
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tree.map((node) => {
                  const firstLeaf = findFirstLeaf([node]);
                  const targetId = firstLeaf?.id ?? node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => router.push(`/knowledge/${targetId}`)}
                      className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                    >
                      <h3 className="text-base font-semibold text-gray-900">
                        {node.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {node.children.length > 0
                          ? `${node.children.length} 个子知识点`
                          : "点击查看详情"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
