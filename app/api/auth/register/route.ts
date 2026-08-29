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

  const { username, password, name, grade } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length < 3 ||
    username.length > 50 ||
    password.length < 6
  ) {
    return NextResponse.json(
      { error: "Username must be 3-50 chars and password at least 6 chars" },
      { status: 400 }
    );
  }

  const nameValue =
    typeof name === "string" && name.length > 0 ? name : null;
  const gradeValue =
    typeof grade === "number" && grade >= 1 && grade <= 9 ? grade : null;

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await argon2.hash(password);

    const insertResult = await pool.query(
      "INSERT INTO users (username, password_hash, role, name, grade) VALUES ($1, $2, 'student', $3, $4) RETURNING id",
      [username, passwordHash, nameValue, gradeValue]
    );
    const userId: number = insertResult.rows[0].id;

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    const cookieStore = await cookies();
    cookieStore.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return NextResponse.json(
      { id: userId, username, role: "student", name: nameValue, grade: gradeValue },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Registration failed", detail: String(error) },
      { status: 500 }
    );
  }
}
