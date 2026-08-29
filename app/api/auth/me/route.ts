import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const result = await getSession();
  if (!result) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      id: result.user.id,
      username: result.user.username,
      role: result.user.role,
      name: result.user.name,
      grade: result.user.grade,
    },
    { status: 200 }
  );
}
