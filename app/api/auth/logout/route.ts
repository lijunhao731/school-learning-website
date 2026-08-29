import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { lucia } from "@/lib/auth/lucia";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "No active session" }, { status: 401 });
  }

  await lucia.invalidateSession(current.session.id);

  const cookieStore = await cookies();
  const blank = lucia.createBlankSessionCookie();
  cookieStore.set(blank.name, blank.value, blank.attributes);

  return NextResponse.json({ success: true }, { status: 200 });
}
