export {};

declare module "lucia" {
  interface Register {
    UserId: number;
    Lucia: typeof import("@/lib/auth/lucia").lucia;
    DatabaseUserAttributes: {
      username: string;
      password_hash: string;
      role: string | null;
      name: string | null;
      grade: number | null;
      avatar_url: string | null;
      created_at: Date | null;
    };
  }
}
