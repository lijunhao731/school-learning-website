"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceInputOptions {
  onTranscribed?: (text: string) => void;
  onError?: (msg: string) => void;
}

interface UseVoiceInputReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

const MIME_CANDIDATES = ["audio/webm", "audio/mp4"];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function useVoiceInput(
  options?: UseVoiceInputOptions
): UseVoiceInputReturn {
  const { onTranscribed, onError } = options ?? {};
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const usingWebSpeechRef = useRef(false);

  const reportError = useCallback(
    (msg: string) => {
      setError(msg);
      onError?.(msg);
    },
    [onError]
  );

  const transcribe = useCallback(async () => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) {
      setIsTranscribing(false);
      return;
    }
    const mimeType = chunks[0].type || "audio/webm";
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob(chunks, { type: mimeType });
    const formData = new FormData();
    formData.append("audio", blob, `recording.${ext}`);

    setIsTranscribing(true);
    try {
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        reportError(data.error ?? "语音识别失败");
        return;
      }
      if (typeof data.text === "string" && data.text) {
        onTranscribed?.(data.text);
      }
    } catch {
      reportError("网络错误，语音识别失败");
    } finally {
      setIsTranscribing(false);
      chunksRef.current = [];
    }
  }, [onTranscribed, reportError]);

  const startWebSpeech = useCallback((): boolean => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return false;
    const recognition = new Ctor();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      if (text) onTranscribed?.(text);
    };
    recognition.onerror = () => {
      reportError("语音识别失败，请重试");
    };
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      usingWebSpeechRef.current = true;
      return true;
    } catch {
      recognitionRef.current = null;
      return false;
    }
  }, [onTranscribed, reportError]);

  const startRecording = useCallback(async () => {
    setError(null);

    // Web Speech API fast path (Chrome desktop / Android).
    if (startWebSpeech()) {
      setIsRecording(true);
      return;
    }

    // Fallback: MediaRecorder + server-side STT.
    if (typeof MediaRecorder === "undefined") {
      reportError("当前浏览器不支持语音录制");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      reportError("无法访问麦克风，请检查权限");
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      reportError("录音初始化失败");
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      void transcribe();
    };
    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }, [reportError, startWebSpeech, transcribe]);

  const stopRecording = useCallback(() => {
    // Web Speech API path.
    if (usingWebSpeechRef.current) {
      recognitionRef.current?.stop();
      usingWebSpeechRef.current = false;
      return;
    }

    // MediaRecorder path.
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsRecording(false);
  }, []);

  // Release mic / stop recognition on unmount.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    error,
  };
}
