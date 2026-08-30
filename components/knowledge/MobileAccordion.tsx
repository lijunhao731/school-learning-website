"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useKnowledgeStore } from "@/lib/stores/knowledge-store";
import type { KnowledgeTreeNode } from "@/lib/db/knowledge-queries";

interface TreeResponse {
  trees: KnowledgeTreeNode[];
}

function AccordionNode({
  node,
  openIds,
  toggleOpen,
}: {
  node: KnowledgeTreeNode;
  openIds: Set<number>;
  toggleOpen: (id: number) => void;
}) {
  const router = useRouter();
  const selectedKpId = useKnowledgeStore((s) => s.selectedKpId);
  const setSelectedKpId = useKnowledgeStore((s) => s.setSelectedKpId);

  const hasChildren = node.children.length > 0;
  const isOpen = openIds.has(node.id);
  const isActive = selectedKpId === node.id;

  const handleClick = () => {
    setSelectedKpId(node.id);
    if (hasChildren) toggleOpen(node.id);
    router.push(`/knowledge/${node.id}`);
  };

  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={hasChildren ? isOpen : undefined}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
          isActive
            ? "bg-blue-50 font-medium text-blue-700"
            : "text-gray-700"
        }`}
      >
        <span className="w-4 shrink-0 text-gray-500" aria-hidden="true">
          {hasChildren ? (isOpen ? "▼" : "▶") : ""}
        </span>
        <span className="flex-1 truncate">{node.title}</span>
      </button>
      {hasChildren && isOpen ? (
        <div className="bg-gray-50">
          {node.children.map((child) => (
            <AccordionNode
              key={child.id}
              node={child}
              openIds={openIds}
              toggleOpen={toggleOpen}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MobileAccordion() {
  const { data, isLoading, error } = useQuery<TreeResponse>({
    queryKey: ["knowledgeTree"],
    queryFn: async (): Promise<TreeResponse> => {
      const res = await fetch("/api/knowledge/tree");
      return (await res.json()) as TreeResponse;
    },
  });
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const toggleOpen = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="lg:hidden border-b border-gray-200 bg-white">
      <div className="px-4 py-2 text-sm font-semibold text-gray-900">
        知识树
      </div>
      {isLoading ? (
        <p className="px-4 py-2 text-sm text-gray-500">加载中…</p>
      ) : error ? (
        <p className="px-4 py-2 text-sm text-red-500">加载失败</p>
      ) : !data || data.trees.length === 0 ? (
        <p className="px-4 py-2 text-sm text-gray-500">暂无知识点</p>
      ) : (
        data.trees.map((node) => (
          <AccordionNode
            key={node.id}
            node={node}
            openIds={openIds}
            toggleOpen={toggleOpen}
          />
        ))
      )}
    </div>
  );
}
