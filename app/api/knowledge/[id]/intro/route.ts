import { NextResponse } from "next/server";
import { generateAllContent, KnowledgePointNotFoundError } from "@/lib/llm/content-generator";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const content = await generateAllContent(numId);
    // 返回纯文本流
    return new Response(content.intro, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof KnowledgePointNotFoundError) {
      return NextResponse.json({ error: "Knowledge point not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "AI 服务暂时不可用" }, { status: 503 });
  }
}
