import { describe, it, expect } from "vitest";
import { errorSchema } from "@/lib/prompts/error-analysis";
import { similarSchema } from "@/lib/prompts/similar-questions";
import { masterySchema } from "@/lib/prompts/mastery-quiz";

describe("errorSchema", () => {
  const valid = {
    questionType: "single-choice",
    errorCause: {
      type: "conceptual",
      description: "Student confused area with perimeter",
    },
    solutionApproach: [
      { step: 1, explanation: "Identify the given values" },
      { step: 2, explanation: "Apply the area formula" },
    ],
    relatedKpIds: ["kp-1", "kp-2"],
    difficulty: "medium",
  };

  it("accepts a valid error analysis", () => {
    expect(() => errorSchema.parse(valid)).not.toThrow();
  });

  it("rejects invalid error cause type", () => {
    const invalid = {
      ...valid,
      errorCause: { type: "invalid", description: "x" },
    };
    expect(() => errorSchema.parse(invalid)).toThrow();
  });

  it("rejects invalid difficulty", () => {
    const invalid = {
      ...valid,
      difficulty: "impossible",
    };
    expect(() => errorSchema.parse(invalid)).toThrow();
  });

  it("rejects solution step starting at 0", () => {
    const invalid = {
      ...valid,
      solutionApproach: [
        { step: 0, explanation: "Invalid step number" },
      ],
    };
    expect(() => errorSchema.parse(invalid)).toThrow();
  });

  it("rejects missing relatedKpIds", () => {
    const { relatedKpIds: _, ...invalid } = valid;
    expect(() => errorSchema.parse(invalid)).toThrow();
  });
});

describe("similarSchema", () => {
  const validQuestion = {
    id: "q1",
    type: "single-choice",
    question: "What is 2 + 2?",
    choices: [
      { text: "4", isCorrect: true },
      { text: "3", isCorrect: false },
    ],
    explanation: "2 + 2 = 4",
    targetsKp: "kp-addition",
  };

  it("accepts a valid similar questions payload", () => {
    expect(() => similarSchema.parse({ questions: [validQuestion] })).not.toThrow();
  });

  it("accepts an empty questions array", () => {
    expect(() => similarSchema.parse({ questions: [] })).not.toThrow();
  });

  it("rejects invalid question type", () => {
    const invalid = {
      ...validQuestion,
      type: "fill-blank",
    };
    expect(() => similarSchema.parse({ questions: [invalid] })).toThrow();
  });

  it("rejects a choice missing isCorrect", () => {
    const invalid = {
      ...validQuestion,
      choices: [{ text: "4" }],
    };
    expect(() => similarSchema.parse({ questions: [invalid] })).toThrow();
  });
});

describe("masterySchema", () => {
  const validQuestion = {
    id: "q1",
    type: "single-choice",
    question: "What is 3 + 3?",
    choices: [
      { text: "6", isCorrect: true },
      { text: "5", isCorrect: false },
    ],
    explanation: "3 + 3 = 6",
    targetsKp: "kp-addition",
  };

  it("accepts exactly 3 questions", () => {
    const payload = {
      questions: [
        { ...validQuestion, id: "q1" },
        { ...validQuestion, id: "q2" },
        { ...validQuestion, id: "q3" },
      ],
    };
    expect(() => masterySchema.parse(payload)).not.toThrow();
  });

  it("rejects fewer than 3 questions", () => {
    const two = {
      questions: [
        { ...validQuestion, id: "q1" },
        { ...validQuestion, id: "q2" },
      ],
    };
    expect(() => masterySchema.parse(two)).toThrow();
  });

  it("rejects more than 3 questions", () => {
    const four = {
      questions: [
        { ...validQuestion, id: "q1" },
        { ...validQuestion, id: "q2" },
        { ...validQuestion, id: "q3" },
        { ...validQuestion, id: "q4" },
      ],
    };
    expect(() => masterySchema.parse(four)).toThrow();
  });
});
