import { NextResponse } from "next/server";
import { generateMathTree } from "@/lib/llm/tree-generator";
import { getTree } from "@/lib/db/knowledge-queries";

export const dynamic = "force-dynamic";

const ALL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export async function GET() {
  try {
    const existing = await getTree("math", 1);
    if (existing) {
      const trees = await Promise.all(
        ALL_GRADES.map((g) => getTree("math", g))
      );
      return NextResponse.json({
        trees: trees.filter((t) => t !== null),
      });
    }

    const trees = await generateMathTree(ALL_GRADES);
    return NextResponse.json({ trees });
  } catch {
    return NextResponse.json(
      { error: "AI 服务暂时不可用，请稍后重试" },
      { status: 503 }
    );
  }
}
