"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

const NAV_ITEMS = [
  { href: "/knowledge", label: "知识" },
  { href: "/mistakes", label: "错题" },
  { href: "/review", label: "复习" },
  { href: "/dashboard", label: "我的" },
];

interface MeResponse {
  id: number;
  username: string;
  role: string;
  name: string | null;
  grade: number | null;
}

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

export function HeaderNav() {
  const pathname = usePathname();
  const router = useRouter();

  const { data: me, isLoading } = useQuery<MeResponse | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return (await res.json()) as MeResponse;
    },
    retry: false,
  });

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="hidden lg:flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-base font-bold text-gray-900">
          K12 学习平台
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {isLoading ? null : me ? (
          <>
            <span className="text-sm text-gray-600">
              {me.name || me.username}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              退出
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            登录
          </Link>
        )}
      </div>
    </header>
  );
}
