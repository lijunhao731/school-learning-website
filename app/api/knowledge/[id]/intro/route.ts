import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  generateCoreIntro,
  KnowledgePointNotFoundError,
} from "@/lib/llm/content-generator";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const result = await generateCoreIntro(numId);
    return result.toTextStreamResponse();
  } catch (error) {
    if (error instanceof KnowledgePointNotFoundError) {
      return NextResponse.json(
        { error: "Knowledge point not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "AI 服务暂时不可用" },
      { status: 503 }
    );
  }
}
