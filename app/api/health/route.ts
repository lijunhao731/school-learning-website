import { NextResponse } from "next/server";
import { checkLLMHealth } from "@/lib/llm/health";

export async function GET() {
  const llm = await checkLLMHealth();
  return NextResponse.json({
    status: llm.available ? "ok" : "degraded",
    llm,
  });
}
