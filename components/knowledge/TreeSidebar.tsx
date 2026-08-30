"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useKnowledgeStore } from "@/lib/stores/knowledge-store";
import type { KnowledgeTreeNode } from "@/lib/db/knowledge-queries";
import { SubjectSelector } from "./SubjectSelector";

interface TreeResponse {
  trees: KnowledgeTreeNode[];
}

type GradeFilter = "all" | "小学" | "初中" | "高中" | "g1" | "g2" | "g3" | "g4" | "g5" | "g6" | "g7" | "g8" | "g9" | "g10" | "g11" | "g12";

const INDENT_CLASSES: readonly string[] = [
  "pl-0",
  "pl-[12px]",
  "pl-[24px]",
  "pl-[36px]",
  "pl-[48px]",
  "pl-[60px]",
  "pl-[72px]",
  "pl-[84px]",
  "pl-[96px]",
];

function indentClass(depth: number): string {
  const idx = Math.min(depth, INDENT_CLASSES.length - 1);
  return INDENT_CLASSES[idx];
}

function gradeLabel(gradeLevel: number): string {
  if (gradeLevel <= 5) return `小${gradeLevel}`;
  if (gradeLevel <= 9) return `初${gradeLevel - 5}`;
  return `高${gradeLevel - 9}`;
}

function TreeNode({
  node,
  depth,
}: {
  node: KnowledgeTreeNode;
  depth: number;
}) {
  const router = useRouter();
  const expandedNodes = useKnowledgeStore((s) => s.expandedNodes);
  const toggleNode = useKnowledgeStore((s) => s.toggleNode);
  const selectedKpId = useKnowledgeStore((s) => s.selectedKpId);
  const setSelectedKpId = useKnowledgeStore((s) => s.setSelectedKpId);

  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isActive = selectedKpId === node.id;

  const handleClick = () => {
    setSelectedKpId(node.id);
    router.push(`/knowledge/${node.id}`);
  };

  return (
    <li className="list-none">
      <div
        className={`flex items-center gap-1 rounded ${indentClass(depth)} ${
          isActive ? "bg-blue-50" : "hover:bg-gray-50"
        }`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleNode(node.id)}
            aria-label={isExpanded ? "折叠" : "展开"}
            aria-expanded={isExpanded}
            className="w-5 shrink-0 text-center text-gray-500"
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="inline-block w-5 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={handleClick}
          className={`flex-1 truncate py-1 text-left text-sm ${
            isActive
              ? "font-medium text-blue-700"
              : "text-gray-700"
          }`}
        >
          {node.title}
          {!hasChildren && node.grade_level != null ? (
            <span className="ml-1 text-xs text-gray-400">
              [{gradeLabel(node.grade_level)}]
            </span>
          ) : null}
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <ul className="m-0 p-0">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TreeSidebar() {
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [subject, setSubject] = useState("math");

  const queryParams = gradeFilter === "all"
    ? `?subject=${encodeURIComponent(subject)}`
    : gradeFilter === "小学" || gradeFilter === "初中" || gradeFilter === "高中"
      ? `?subject=${encodeURIComponent(subject)}&stage=${encodeURIComponent(gradeFilter)}`
      : `?subject=${encodeURIComponent(subject)}&grade=${gradeFilter.replace("g", "")}`;

  const { data, isLoading, error } = useQuery<TreeResponse>({
    queryKey: ["knowledgeTree", subject, gradeFilter],
    queryFn: async (): Promise<TreeResponse> => {
      const res = await fetch(`/api/knowledge/tree${queryParams}`);
      return (await res.json()) as TreeResponse;
    },
  });

  const FILTER_OPTIONS: { value: GradeFilter; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "小学", label: "小学" },
    { value: "g1", label: "小1" },
    { value: "g2", label: "小2" },
    { value: "g3", label: "小3" },
    { value: "g4", label: "小4" },
    { value: "g5", label: "小5" },
    { value: "初中", label: "初中" },
    { value: "高中", label: "高中" },
  ];

  return (
    <aside className="hidden lg:block w-64 shrink-0 border-r border-gray-200 bg-white p-4 overflow-y-auto">
      <h2 className="mb-2 text-sm font-semibold text-gray-900">知识树</h2>
      {/* 学科选择器 */}
      <div className="mb-2">
        <SubjectSelector value={subject} onChange={setSubject} />
      </div>
      {/* 年级筛选器 */}
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setGradeFilter(opt.value)}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              gradeFilter === opt.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-500">加载中…</p>
      ) : error ? (
        <p className="text-sm text-red-500">加载失败</p>
      ) : !data || data.trees.length === 0 ? (
        <p className="text-sm text-gray-500">该年级暂无知识点</p>
      ) : (
        <ul className="m-0 p-0">
          {data.trees.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} />
          ))}
        </ul>
      )}
    </aside>
  );
}
