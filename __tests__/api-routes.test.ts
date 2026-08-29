import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks (hoisted) ────────────────────────────────────────────────────────
// All external dependencies of the API routes are mocked so no real DB,
// filesystem, or auth backend is touched.

const apiMocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  poolConnect: vi.fn(),
  createSession: vi.fn(),
  createSessionCookie: vi.fn(),
  cookies: vi.fn(),
  argonHash: vi.fn(),
  argonVerify: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  pool: { query: apiMocks.poolQuery, connect: apiMocks.poolConnect },
}));

vi.mock("@/lib/auth/lucia", () => ({
  lucia: {
    createSession: apiMocks.createSession,
    createSessionCookie: apiMocks.createSessionCookie,
    validateSession: vi.fn(),
    sessionCookieName: "auth_session",
  },
}));

vi.mock("next/headers", () => ({
  cookies: apiMocks.cookies,
}));

vi.mock("argon2", () => ({
  default: { hash: apiMocks.argonHash, verify: apiMocks.argonVerify },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: apiMocks.getSession,
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

// ── Route handlers ─────────────────────────────────────────────────────────
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as uploadPost } from "@/app/api/mistakes/upload/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function emptyRequest(url: string): Request {
  return new Request(url, { method: "POST" });
}

// ── Test setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Defaults that apply to most tests; individual tests override as needed.
  apiMocks.createSession.mockResolvedValue({ id: "session-id" });
  apiMocks.createSessionCookie.mockReturnValue({
    name: "auth_session",
    value: "cookie-value",
    attributes: { path: "/", sameSite: "lax" },
  });
  apiMocks.cookies.mockResolvedValue({ set: vi.fn() });
});

// ── Register ────────────────────────────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("registers a new user and returns 201", async () => {
    apiMocks.poolQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing user
      .mockResolvedValueOnce({ rows: [{ id: 42 }], rowCount: 1 }); // insert
    apiMocks.argonHash.mockResolvedValue("$argon2id$hashed");

    const request = jsonRequest("http://localhost/api/auth/register", {
      username: "newuser",
      password: "password123",
      name: "New User",
      grade: 5,
    });

    const response = await registerPost(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe(42);
    expect(body.username).toBe("newuser");
    expect(body.role).toBe("student");
    expect(body.name).toBe("New User");
    expect(body.grade).toBe(5);

    // Password was hashed before insert
    expect(apiMocks.argonHash).toHaveBeenCalledWith("password123");
    // Session was created and cookie set
    expect(apiMocks.createSession).toHaveBeenCalledWith(42, {});
    expect(apiMocks.createSessionCookie).toHaveBeenCalledWith("session-id");
  });

  it("returns 400 when username is too short", async () => {
    const request = jsonRequest("http://localhost/api/auth/register", {
      username: "ab",
      password: "password123",
    });

    const response = await registerPost(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Username");
    expect(apiMocks.poolQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when password is too short", async () => {
    const request = jsonRequest("http://localhost/api/auth/register", {
      username: "validuser",
      password: "12345",
    });

    const response = await registerPost(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const request = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    });

    const response = await registerPost(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 409 when username is already taken", async () => {
    apiMocks.poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1 }],
      rowCount: 1,
    });

    const request = jsonRequest("http://localhost/api/auth/register", {
      username: "existinguser",
      password: "password123",
    });

    const response = await registerPost(request);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("already taken");
    // Should not have attempted to hash or insert
    expect(apiMocks.argonHash).not.toHaveBeenCalled();
    expect(apiMocks.createSession).not.toHaveBeenCalled();
  });
});

// ── Login ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("logs in successfully and returns 200", async () => {
    apiMocks.poolQuery.mockResolvedValue({
      rows: [
        {
          id: 7,
          username: "alice",
          password_hash: "$argon2id$hash",
          role: "student",
          name: "Alice",
          grade: 3,
        },
      ],
      rowCount: 1,
    });
    apiMocks.argonVerify.mockResolvedValue(true);

    const request = jsonRequest("http://localhost/api/auth/login", {
      username: "alice",
      password: "correctPassword",
    });

    const response = await loginPost(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(7);
    expect(body.username).toBe("alice");

    expect(apiMocks.argonVerify).toHaveBeenCalledWith(
      "$argon2id$hash",
      "correctPassword"
    );
    expect(apiMocks.createSession).toHaveBeenCalledWith(7, {});
  });

  it("returns 401 when password is wrong", async () => {
    apiMocks.poolQuery.mockResolvedValue({
      rows: [
        {
          id: 7,
          username: "alice",
          password_hash: "$argon2id$hash",
        },
      ],
      rowCount: 1,
    });
    apiMocks.argonVerify.mockResolvedValue(false);

    const request = jsonRequest("http://localhost/api/auth/login", {
      username: "alice",
      password: "wrongPassword",
    });

    const response = await loginPost(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
    expect(apiMocks.createSession).not.toHaveBeenCalled();
  });

  it("returns 401 when user does not exist", async () => {
    apiMocks.poolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const request = jsonRequest("http://localhost/api/auth/login", {
      username: "ghost",
      password: "anything",
    });

    const response = await loginPost(request);

    expect(response.status).toBe(401);
    expect(apiMocks.argonVerify).not.toHaveBeenCalled();
    expect(apiMocks.createSession).not.toHaveBeenCalled();
  });

  it("returns 400 when username or password is missing", async () => {
    const request = jsonRequest("http://localhost/api/auth/login", {
      username: "onlyusername",
    });

    const response = await loginPost(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("required");
  });
});

// ── Upload auth check ──────────────────────────────────────────────────────

describe("POST /api/mistakes/upload", () => {
  it("returns 401 when not authenticated", async () => {
    apiMocks.getSession.mockResolvedValue(null);

    const response = await uploadPost(emptyRequest("http://localhost/api/mistakes/upload"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("does not return 401 when session exists", async () => {
    apiMocks.getSession.mockResolvedValue({
      session: { id: "s1" },
      user: { id: 1, username: "u", role: "student" },
    });

    // Send a request with no form data — the route should get past the auth
    // check and return 400 (no file / invalid form data), NOT 401.
    const request = emptyRequest("http://localhost/api/mistakes/upload");

    const response = await uploadPost(request);

    expect(response.status).not.toBe(401);
  });
});
