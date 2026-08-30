"use client";

import { SUBJECTS, type SubjectConfig } from "@/lib/subjects";

interface SubjectSelectorProps {
  value: string;
  onChange: (subject: string) => void;
}

export function SubjectSelector({ value, onChange }: SubjectSelectorProps) {
  return (
    <div className="flex gap-1 overflow-x-auto">
      {SUBJECTS.map((subj: SubjectConfig) => (
        <button
          key={subj.value}
          type="button"
          onClick={() => onChange(subj.value)}
          className={`shrink-0 rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
            value === subj.value
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {subj.label}
        </button>
      ))}
    </div>
  );
}
