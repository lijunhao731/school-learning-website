import { NextResponse } from "next/server";
import { getRelatedKPs } from "@/lib/db/knowledge-queries";

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
    const related = await getRelatedKPs(numId);
    return NextResponse.json({ related });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load related knowledge points", detail: String(error) },
      { status: 500 }
    );
  }
}
