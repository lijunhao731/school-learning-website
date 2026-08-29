import { NextResponse } from "next/server";
import { getAncestors } from "@/lib/db/knowledge-queries";

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
    const ancestors = await getAncestors(numId);
    return NextResponse.json({ ancestors });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load ancestors", detail: String(error) },
      { status: 500 }
    );
  }
}
