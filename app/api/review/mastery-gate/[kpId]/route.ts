import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateMasteryQuiz } from "@/lib/mastery/mastery-gate";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kpId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kpId } = await params;
  const numId = Number(kpId);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: "Invalid kpId" }, { status: 400 });
  }

  try {
    const result = await generateMasteryQuiz(session.user.id, numId);
    if (!result) {
      return NextResponse.json(
        { error: "Mastery gate conditions not met" },
        { status: 409 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to generate mastery quiz:", error);
    return NextResponse.json(
      { error: "AI 服务暂时不可用" },
      { status: 503 }
    );
  }
}
