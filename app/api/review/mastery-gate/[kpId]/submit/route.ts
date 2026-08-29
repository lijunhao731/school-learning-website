import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { submitMasteryGate } from "@/lib/mastery/mastery-gate";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { quizAttemptId, answers } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof quizAttemptId !== "number" ||
    !Number.isInteger(quizAttemptId) ||
    quizAttemptId <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid quizAttemptId" },
      { status: 400 }
    );
  }

  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  }

  const typedAnswers: { questionId: string; selectedIndex: number }[] = [];
  for (const entry of answers) {
    const ans = entry as Record<string, unknown>;
    if (
      typeof ans.questionId !== "string" ||
      typeof ans.selectedIndex !== "number" ||
      !Number.isInteger(ans.selectedIndex) ||
      ans.selectedIndex < 0
    ) {
      return NextResponse.json(
        { error: "Invalid answer format" },
        { status: 400 }
      );
    }
    typedAnswers.push({
      questionId: ans.questionId,
      selectedIndex: ans.selectedIndex,
    });
  }

  try {
    const result = await submitMasteryGate(
      session.user.id,
      numId,
      quizAttemptId,
      typedAnswers
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to submit mastery gate:", error);
    return NextResponse.json(
      { error: "Failed to process submission" },
      { status: 500 }
    );
  }
}
