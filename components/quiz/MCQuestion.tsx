"use client";

import { useState } from "react";

export interface MCQuestionData {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}

interface MCQuestionProps {
  question: MCQuestionData;
  onAnswer?: (correct: boolean) => void;
}

const CHOICE_LABELS = ["A", "B", "C", "D"];

export function MCQuestion({ question, onAnswer }: MCQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    onAnswer?.(index === question.answer);
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <p className="text-gray-900">{question.question}</p>
      <div className="space-y-2">
        {question.choices.map((choice, index) => {
          let className = "w-full text-left p-3 border rounded";
          if (answered) {
            if (index === question.answer) {
              className += " bg-green-50 border-green-500";
            } else if (index === selected) {
              className += " bg-red-50 border-red-500";
            }
          }
          return (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(index)}
              disabled={answered}
              className={className}
            >
              <span className="mr-2 font-medium">{CHOICE_LABELS[index]}.</span>
              {choice}
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">
            {selected === question.answer ? "回答正确" : "回答错误"}
          </p>
          <p className="text-sm text-gray-600">{question.explanation}</p>
        </div>
      ) : null}
    </div>
  );
}
