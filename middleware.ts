import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 受保护的页面路由前缀（未登录重定向到 /login）
const PROTECTED_PAGE_PREFIXES = ["/dashboard", "/mistakes", "/review", "/knowledge"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("auth_session");

  // API 路由：未登录返回 401 JSON（auth 和 health 除外）
  const isApi = pathname.startsWith("/api/");
  const isAuthApi = pathname.startsWith("/api/auth/");
  const isHealthApi = pathname.startsWith("/api/health");

  if (isApi && !isAuthApi && !isHealthApi) {
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 页面路由：未登录重定向到 /login?redirect=原始路径
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtectedPage && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/dashboard", "/mistakes/:path*", "/mistakes", "/review/:path*", "/review", "/knowledge/:path*", "/knowledge"],
};
