"use client";

import { useVoiceInput } from "@/hooks/useVoiceInput";

interface VoiceButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

export function VoiceButton({ onTranscribed, disabled }: VoiceButtonProps) {
  const { isRecording, isTranscribing, startRecording, stopRecording, error } =
    useVoiceInput({ onTranscribed });

  const handleClick = () => {
    if (isTranscribing || disabled) return;
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        aria-label={isRecording ? "停止录音" : "开始录音"}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
          isRecording
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        {isRecording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-75" />
        )}
        {isTranscribing ? (
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              d="M4 12a8 8 0 0 1 8-8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="relative"
            aria-hidden="true"
          >
            <path d="M12 2a3 3 0 0 0 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 0 3-3z" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>
      {(error || isRecording || isTranscribing) && (
        <span
          className={`text-xs ${error ? "text-red-600" : "text-gray-600"}`}
        >
          {error
            ? error
            : isRecording
              ? "录制中..."
              : "识别中..."}
        </span>
      )}
    </div>
  );
}
