"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useKnowledgeStore } from "@/lib/stores/knowledge-store";
import type { KnowledgeTreeNode } from "@/lib/db/knowledge-queries";
import { SubjectSelector } from "./SubjectSelector";

interface TreeResponse {
  trees: KnowledgeTreeNode[];
}

type GradeFilter = "all" | "小学" | "初中" | "高中" | "g1" | "g2" | "g3" | "g4" | "g5" | "g6" | "g7" | "g8" | "g9" | "g10" | "g11" | "g12";

function gradeLabel(g: number): string {
  if (g <= 5) return `小${g}`;
  if (g <= 9) return `初${g - 5}`;
  return `高${g - 9}`;
}

function AccordionNode({
  node,
  depth,
  openIds,
  toggleOpen,
}: {
  node: KnowledgeTreeNode;
  depth: number;
  openIds: Set<number>;
  toggleOpen: (id: number) => void;
}) {
  const router = useRouter();
  const selectedKpId = useKnowledgeStore((s) => s.selectedKpId);
  const setSelectedKpId = useKnowledgeStore((s) => s.setSelectedKpId);

  const hasChildren = node.children.length > 0;
  const isOpen = openIds.has(node.id);
  const isActive = selectedKpId === node.id;
  const isLeaf = !hasChildren;

  const handleClick = () => {
    setSelectedKpId(node.id);
    if (hasChildren) toggleOpen(node.id);
    if (isLeaf || node.grade_level != null) {
      router.push(`/knowledge/${node.id}`);
    }
  };

  // 层次样式
  const depthStyles = [
    { pad: "pl-3", icon: "text-base", title: "font-semibold text-gray-900", bg: "bg-white" },
    { pad: "pl-6", icon: "text-sm", title: "font-medium text-gray-700", bg: "bg-gray-50" },
    { pad: "pl-9", icon: "text-xs", title: "text-gray-600", bg: "bg-gray-50" },
  ];
  const style = depthStyles[Math.min(depth, depthStyles.length - 1)];

  return (
    <div className={`border-b border-gray-100 ${style.bg}`}>
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={hasChildren ? isOpen : undefined}
        className={`flex w-full items-center gap-1.5 py-2.5 pr-3 text-left ${style.pad} ${
          isActive ? "bg-blue-50" : ""
        } transition-colors`}
      >
        {/* 展开/折叠图标 */}
        <span className={`w-4 shrink-0 ${style.icon} ${hasChildren ? "text-blue-500" : "text-gray-300"}`} aria-hidden="true">
          {hasChildren ? (isOpen ? "▼" : "▶") : "•"}
        </span>
        {/* 标题 */}
        <span className={`flex-1 truncate ${style.title} ${isActive ? "text-blue-600" : ""}`}>
          {node.title}
        </span>
        {/* 叶子节点显示年级标签 */}
        {isLeaf && node.grade_level != null ? (
          <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
            {gradeLabel(node.grade_level)}
          </span>
        ) : null}
        {/* 非叶子有子节点数 */}
        {hasChildren ? (
          <span className="shrink-0 text-xs text-gray-400">{node.children.length}</span>
        ) : null}
      </button>
      {/* 子节点 */}
      {hasChildren && isOpen ? (
        <div className="border-l-2 border-blue-100 ml-3">
          {node.children.map((child) => (
            <AccordionNode
              key={child.id}
              node={child}
              depth={depth + 1}
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
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [subject, setSubject] = useState("math");

  const queryParams = gradeFilter === "all"
    ? `?subject=${subject}`
    : gradeFilter === "小学" || gradeFilter === "初中" || gradeFilter === "高中"
      ? `?subject=${subject}&stage=${gradeFilter}`
      : `?subject=${subject}&grade=${gradeFilter.replace("g", "")}`;

  const { data, isLoading, error } = useQuery<TreeResponse>({
    queryKey: ["knowledgeTree", subject, gradeFilter],
    queryFn: async (): Promise<TreeResponse> => {
      const res = await fetch(`/api/knowledge/tree${queryParams}`);
      return (await res.json()) as TreeResponse;
    },
  });
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  // 数据加载后默认展开第一层（大类），让用户看到小类
  useEffect(() => {
    if (data && data.trees.length > 0) {
      setOpenIds(new Set(data.trees.map((t) => t.id)));
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOpen = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    <div className="lg:hidden border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-sm font-semibold text-gray-900">知识树</span>
      </div>
      {/* 学科选择器 */}
      <div className="mx-4 mb-2">
        <SubjectSelector value={subject} onChange={setSubject} />
      </div>
      {/* 年级筛选器 */}
      <div className="mx-4 mb-2 flex flex-wrap gap-1">
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
      {/* 提示文字 */}
      <p className="px-4 pb-1 text-xs text-gray-400">
        点击大类展开小类，再点击具体知识点查看详情
      </p>
      {isLoading ? (
        <p className="px-4 py-3 text-sm text-gray-500">加载中…</p>
      ) : error ? (
        <p className="px-4 py-3 text-sm text-red-500">加载失败</p>
      ) : !data || data.trees.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">该年级暂无知识点</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {data.trees.map((node) => (
            <AccordionNode
              key={node.id}
              node={node}
              depth={0}
              openIds={openIds}
              toggleOpen={toggleOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}
