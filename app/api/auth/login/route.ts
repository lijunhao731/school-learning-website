import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import argon2 from "argon2";
import { pool } from "@/lib/db/client";
import { lucia } from "@/lib/auth/lucia";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password } = (body ?? {}) as Record<string, unknown>;

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      "SELECT id, username, password_hash, role, name, grade FROM users WHERE username = $1",
      [username]
    );
    if (!result.rowCount || result.rowCount === 0) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const user = result.rows[0] as {
      id: number;
      password_hash: string;
    };

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    const cookieStore = await cookies();
    cookieStore.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return NextResponse.json(
      {
        id: user.id,
        username,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Login failed", detail: String(error) },
      { status: 500 }
    );
  }
}
