import { cookies } from "next/headers";
import { lucia } from "./lucia";

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return null;

  const result = await lucia.validateSession(sessionId);
  if (!result.session || !result.user) return null;
  return result;
}

export async function requireAuth() {
  const result = await getSession();
  if (!result) {
    throw new Error("Unauthorized");
  }
  return result;
}

export async function requireRole(role: string) {
  const result = await requireAuth();
  if (result.user.role !== "admin" && result.user.role !== role) {
    throw new Error("Forbidden");
  }
  return result;
}
