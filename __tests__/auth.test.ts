import { describe, it, expect, beforeEach, vi } from "vitest";
import argon2 from "argon2";
import { getSession, requireAuth, requireRole } from "@/lib/auth/session";

// ── Mocks ──────────────────────────────────────────────────────────────────
// Mock lucia so session.ts never touches the real DB-backed Lucia instance.
// Mock next/headers so cookies() works outside the Next.js request scope.

const authMocks = vi.hoisted(() => ({
  validateSession: vi.fn(),
  cookiesGet: vi.fn(),
  cookiesSet: vi.fn(),
}));

vi.mock("@/lib/auth/lucia", () => ({
  lucia: {
    sessionCookieName: "auth_session",
    validateSession: authMocks.validateSession,
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: authMocks.cookiesGet,
    set: authMocks.cookiesSet,
  })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function setSessionCookie(value: string | undefined) {
  authMocks.cookiesGet.mockImplementation((name: string) => {
    if (name === "auth_session" && value !== undefined) {
      return { name, value };
    }
    return undefined;
  });
}

function setValidateResult(
  session: { id: string } | null,
  user: { id: number; username: string; role: string } | null
) {
  authMocks.validateSession.mockResolvedValue({ session, user });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Password hashing (Argon2id)", () => {
  it("produces a verifiable Argon2id hash", async () => {
    const password = "mySecretPassword123";

    const hash = await argon2.hash(password);

    expect(hash).not.toBe(password);
    expect(hash).toContain("$argon2id$");
    expect(await argon2.verify(hash, password)).toBe(true);
    expect(await argon2.verify(hash, "wrongPassword")).toBe(false);
  });

  it("produces different hashes for different passwords", async () => {
    const hash1 = await argon2.hash("password-one");
    const hash2 = await argon2.hash("password-two");

    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const hash1 = await argon2.hash("samePassword");
    const hash2 = await argon2.hash("samePassword");

    expect(hash1).not.toBe(hash2);
    // Both should still verify against the original password
    expect(await argon2.verify(hash1, "samePassword")).toBe(true);
    expect(await argon2.verify(hash2, "samePassword")).toBe(true);
  });
});

describe("getSession", () => {
  beforeEach(() => {
    authMocks.validateSession.mockReset();
    authMocks.cookiesGet.mockReset();
  });

  it("returns null when no session cookie is present", async () => {
    setSessionCookie(undefined);

    const result = await getSession();

    expect(result).toBeNull();
    expect(authMocks.validateSession).not.toHaveBeenCalled();
  });

  it("returns session and user when the session is valid", async () => {
    setSessionCookie("valid-session-id");
    setValidateResult(
      { id: "valid-session-id" },
      { id: 1, username: "alice", role: "student" }
    );

    const result = await getSession();

    expect(result).not.toBeNull();
    expect(result?.session).toEqual({ id: "valid-session-id" });
    expect(result?.user.username).toBe("alice");
    expect(authMocks.validateSession).toHaveBeenCalledWith("valid-session-id");
  });

  it("returns null when validateSession returns no session", async () => {
    setSessionCookie("expired-session-id");
    setValidateResult(null, null);

    const result = await getSession();

    expect(result).toBeNull();
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    authMocks.validateSession.mockReset();
    authMocks.cookiesGet.mockReset();
  });

  it("throws Unauthorized when no session exists", async () => {
    setSessionCookie(undefined);

    await expect(requireAuth()).rejects.toThrow("Unauthorized");
  });

  it("returns the session when authenticated", async () => {
    setSessionCookie("valid-session-id");
    setValidateResult(
      { id: "valid-session-id" },
      { id: 1, username: "alice", role: "student" }
    );

    const result = await requireAuth();

    expect(result.user.username).toBe("alice");
  });
});

describe("requireRole (RBAC)", () => {
  beforeEach(() => {
    authMocks.validateSession.mockReset();
    authMocks.cookiesGet.mockReset();
  });

  it("allows access when user has the required role", async () => {
    setSessionCookie("valid-session-id");
    setValidateResult(
      { id: "valid-session-id" },
      { id: 1, username: "bob", role: "teacher" }
    );

    const result = await requireRole("teacher");

    expect(result.user.role).toBe("teacher");
  });

  it("allows access when user is admin (admin bypasses role check)", async () => {
    setSessionCookie("valid-session-id");
    setValidateResult(
      { id: "valid-session-id" },
      { id: 1, username: "root", role: "admin" }
    );

    const result = await requireRole("teacher");

    expect(result.user.role).toBe("admin");
  });

  it("throws Forbidden when user has a different role", async () => {
    setSessionCookie("valid-session-id");
    setValidateResult(
      { id: "valid-session-id" },
      { id: 1, username: "charlie", role: "student" }
    );

    await expect(requireRole("teacher")).rejects.toThrow("Forbidden");
  });

  it("throws Unauthorized when no session exists", async () => {
    setSessionCookie(undefined);

    await expect(requireRole("teacher")).rejects.toThrow("Unauthorized");
  });
});
