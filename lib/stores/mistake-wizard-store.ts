import { create } from "zustand";
import type { ErrorAnalysis } from "@/lib/prompts/error-analysis";
import type { SimilarQuestions } from "@/lib/prompts/similar-questions";

export type WizardStep = "photo" | "ocr" | "analysis" | "quiz" | "summary";

export interface MistakeWizardState {
  step: WizardStep;
  imageUrl: string | null;
  ocrText: string;
  ocrFormulas: { latex: string }[];
  ocrSource: string; // "llm-vision" | "tesseract" | "manual"
  studentAnswer: string;
  errorAnalysis: ErrorAnalysis | null;
  mistakeId: number | null;
  similarQuestions: SimilarQuestions | null;
  quizResults: { questionId: string; correct: boolean }[];
  loading: boolean;
  error: string | null;

  // Actions
  setStep: (step: WizardStep) => void;
  setImageUrl: (url: string) => void;
  setOcrResult: (
    text: string,
    formulas: { latex: string }[],
    source: string
  ) => void;
  setOcrText: (text: string) => void;
  setStudentAnswer: (answer: string) => void;
  setErrorAnalysis: (analysis: ErrorAnalysis) => void;
  setMistakeId: (id: number) => void;
  setSimilarQuestions: (questions: SimilarQuestions) => void;
  addQuizResult: (questionId: string, correct: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  step: "photo" as WizardStep,
  imageUrl: null as string | null,
  ocrText: "",
  ocrFormulas: [] as { latex: string }[],
  ocrSource: "",
  studentAnswer: "",
  errorAnalysis: null as ErrorAnalysis | null,
  mistakeId: null as number | null,
  similarQuestions: null as SimilarQuestions | null,
  quizResults: [] as { questionId: string; correct: boolean }[],
  loading: false,
  error: null as string | null,
};

export const useMistakeWizardStore = create<MistakeWizardState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setImageUrl: (url) => set({ imageUrl: url }),
  setOcrResult: (text, formulas, source) =>
    set({ ocrText: text, ocrFormulas: formulas, ocrSource: source }),
  setOcrText: (text) => set({ ocrText: text }),
  setStudentAnswer: (answer) => set({ studentAnswer: answer }),
  setErrorAnalysis: (analysis) => set({ errorAnalysis: analysis }),
  setMistakeId: (id) => set({ mistakeId: id }),
  setSimilarQuestions: (questions) => set({ similarQuestions: questions }),
  addQuizResult: (questionId, correct) =>
    set((state) => {
      const rest = state.quizResults.filter(
        (r) => r.questionId !== questionId
      );
      return { quizResults: [...rest, { questionId, correct }] };
    }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
