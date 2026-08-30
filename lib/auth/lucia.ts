import { Lucia, TimeSpan } from "lucia";
import { NodePostgresAdapter } from "@lucia-auth/adapter-postgresql";
import { pool } from "@/lib/db/client";

const adapter = new NodePostgresAdapter(pool, {
  user: "users",
  session: "sessions",
});

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(30, "d"),
  sessionCookie: {
    attributes: {
      // HTTP 部署（如 IP+端口）需关闭 secure，否则浏览器不保存 session cookie
      // 设 COOKIE_SECURE=1 可强制开启（用于 HTTPS 域名部署）
      secure: process.env.COOKIE_SECURE === "1",
      sameSite: "lax",
      path: "/",
    },
  },
  getUserAttributes: (attributes) => ({
    username: attributes.username,
    role: attributes.role ?? "student",
    name: attributes.name,
    grade: attributes.grade,
  }),
});
