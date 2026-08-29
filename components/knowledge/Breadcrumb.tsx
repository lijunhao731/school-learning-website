"use client";

import { useQuery } from "@tanstack/react-query";
import { useKnowledgeStore } from "@/lib/stores/knowledge-store";
import type { KnowledgePoint } from "@/lib/db/knowledge-queries";

interface AncestorsResponse {
  ancestors: KnowledgePoint[];
}

interface BreadcrumbProps {
  kpId: number | null;
}

export function Breadcrumb({ kpId }: BreadcrumbProps) {
  const setSelectedKpId = useKnowledgeStore((s) => s.setSelectedKpId);
  const enabled = kpId !== null;

  const { data, isLoading, error } = useQuery<AncestorsResponse>({
    queryKey: ["ancestors", kpId],
    enabled,
    queryFn: async (): Promise<AncestorsResponse> => {
      const res = await fetch(`/api/knowledge/${kpId}/ancestors`);
      return (await res.json()) as AncestorsResponse;
    },
  });

  if (!enabled) return null;

  if (isLoading) {
    return (
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        加载中…
      </nav>
    );
  }

  if (error) {
    return (
      <nav className="flex items-center gap-2 text-sm text-red-500">
        加载失败
      </nav>
    );
  }

  const ancestors = data?.ancestors ?? [];

  if (ancestors.length === 0) {
    return (
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        根节点
      </nav>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
      {ancestors.map((ancestor, i) => (
        <div key={ancestor.id} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedKpId(ancestor.id)}
            className="hover:text-blue-600 hover:underline"
          >
            {ancestor.title}
          </button>
          {i < ancestors.length - 1 ? (
            <span className="text-gray-400" aria-hidden="true">
              {">"}
            </span>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
