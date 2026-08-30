import { NextResponse } from "next/server";
import { generateAllContent } from "@/lib/llm/content-generator";
import { requireAuth } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();

  const { id } = await params;
  const kpId = parseInt(id, 10);
  if (!Number.isInteger(kpId) || kpId <= 0) {
    return NextResponse.json({ error: "无效的知识点 ID" }, { status: 400 });
  }

  try {
    const content = await generateAllContent(kpId);
    return NextResponse.json(content);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "生成失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
