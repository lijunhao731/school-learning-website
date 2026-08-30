/** 学科配置 */

export interface SubjectConfig {
  value: string;
  label: string;
  color: string;
}

export const SUBJECTS: SubjectConfig[] = [
  { value: "math", label: "数学", color: "blue" },
  { value: "chinese", label: "语文", color: "red" },
  { value: "english", label: "英语", color: "green" },
  { value: "french", label: "法语", color: "purple" },
];

export const DEFAULT_SUBJECT = "math";

export function getSubjectLabel(value: string): string {
  return SUBJECTS.find((s) => s.value === value)?.label ?? value;
}

export function getSubjectColor(value: string): string {
  return SUBJECTS.find((s) => s.value === value)?.color ?? "blue";
}
