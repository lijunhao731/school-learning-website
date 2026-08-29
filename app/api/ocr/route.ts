import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { runOCRPipeline } from "@/lib/ocr/pipeline";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { imageUrl } = (body ?? {}) as Record<string, unknown>;

  if (typeof imageUrl !== "string" || imageUrl.length === 0) {
    return NextResponse.json(
      { error: "imageUrl is required" },
      { status: 400 }
    );
  }

  try {
    const result = await runOCRPipeline(imageUrl);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("OCR pipeline failed:", error);
    return NextResponse.json(
      { error: "OCR pipeline failed", detail: String(error) },
      { status: 500 }
    );
  }
}
