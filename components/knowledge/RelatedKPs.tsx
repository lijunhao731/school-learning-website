"use client";

import { useQuery } from "@tanstack/react-query";
import { useKnowledgeStore } from "@/lib/stores/knowledge-store";
import type { KnowledgePoint } from "@/lib/db/knowledge-queries";

interface RelatedKPsResponse {
  related: KnowledgePoint[];
}

interface RelatedKPsProps {
  kpId: number | null;
}

export function RelatedKPs({ kpId }: RelatedKPsProps) {
  const setSelectedKpId = useKnowledgeStore((s) => s.setSelectedKpId);
  const enabled = kpId !== null;

  const { data } = useQuery<RelatedKPsResponse>({
    queryKey: ["relatedKPs", kpId],
    enabled,
    queryFn: () =>
      fetch(`/api/knowledge/${kpId}/related`).then((r) => r.json()),
  });

  if (!enabled) return null;

  const related = data?.related ?? [];

  if (related.length === 0) return null;

  return (
    <aside className="w-full border rounded-lg p-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">相关知识点</h2>
      {related.map((kp) => (
        <button
          key={kp.id}
          type="button"
          onClick={() => setSelectedKpId(kp.id)}
          className="block text-sm text-blue-600 hover:underline"
        >
          {kp.title}
        </button>
      ))}
    </aside>
  );
}
