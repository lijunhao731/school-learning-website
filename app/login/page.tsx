"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "register";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">加载中…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body: Record<string, unknown> = { username, password };
    if (mode === "register") {
      if (name.trim()) body.name = name.trim();
      if (grade !== "") body.grade = grade;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || (mode === "login" ? "登录失败" : "注册失败"));
        setLoading(false);
        return;
      }

      // 用 window.location 强制跳转，确保 cookie 生效后整页加载
      window.location.href = redirect;
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "register" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
              用户名
            </label>
            <input
              id="username"
              type="text"
              required
              minLength={3}
              maxLength={50}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="3-50 个字符"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="至少 6 位"
            />
          </div>

          {mode === "register" ? (
            <>
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                  姓名（选填）
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="你的名字"
                />
              </div>
              <div>
                <label htmlFor="grade" className="mb-1 block text-sm font-medium text-gray-700">
                  年级（选填）
                </label>
                <select
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value === "" ? "" : Number(e.target.value))}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">不选择</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                    <option key={g} value={g}>
                      {g <= 6 ? `小学${g}年级` : `初一至初三${g - 6}年级`}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600">返回首页</Link>
      </p>
    </main>
  );
}
