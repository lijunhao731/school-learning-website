import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

const DEFAULT_LLM_BASE_URL = "http://36.133.77.84:64025/v1";
const DEFAULT_LLM_API_KEY =
  "gpustack_53402c89fc1b8ff0_7f055b69257ea707820ef6fae0804aa3";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json(
      { error: "No audio file provided" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.LLM_BASE_URL || DEFAULT_LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY || DEFAULT_LLM_API_KEY;

  const forwardForm = new FormData();
  const filename = audio.name || "audio.webm";
  forwardForm.append("file", audio, filename);

  try {
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: forwardForm,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("STT upstream error:", res.status, detail);
      return NextResponse.json(
        { error: "语音识别服务不可用" },
        { status: 503 }
      );
    }

    const data = (await res.json()) as { text?: string };
    const text = data.text;
    if (typeof text !== "string") {
      return NextResponse.json(
        { error: "语音识别服务返回异常" },
        { status: 502 }
      );
    }

    return NextResponse.json({ text }, { status: 200 });
  } catch (error) {
    console.error("Voice transcription failed:", error);
    return NextResponse.json(
      { error: "语音识别服务不可用" },
      { status: 503 }
    );
  }
}
