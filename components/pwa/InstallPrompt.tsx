"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari exposes navigator.standalone (non-standard).
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Respect a previous dismissal stored in localStorage.
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    // Already installed / running standalone — never prompt.
    if (isStandalone()) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
      setShowIOS(false);
      // Once installed, remember not to prompt again.
      localStorage.setItem(DISMISS_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS never fires beforeinstallprompt — show a manual hint instead.
    if (isIOS() && !isStandalone()) {
      setShowIOS(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt || installing) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "dismissed") {
        dismiss();
      }
      // "accepted" is handled by the appinstalled event.
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  }

  function dismiss() {
    setVisible(false);
    setShowIOS(false);
    localStorage.setItem(DISMISS_KEY, "true");
  }

  if (!visible) return null;

  // iOS: no native prompt, guide the user to "Add to Home Screen".
  if (showIOS && !deferredPrompt) {
    return (
      <div
        role="dialog"
        aria-label="安装到主屏幕"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
      >
        <div className="mx-auto flex max-w-md items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-lg font-bold text-white">
            π
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">
              添加到主屏幕
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              点击 Safari 底部的分享按钮，选择「添加到主屏幕」即可像原生 App 一样使用。
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="关闭"
            className="-mr-1 shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mx-auto mt-2 max-w-md pb-2">
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-lg bg-blue-500 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
          >
            知道了
          </button>
        </div>
      </div>
    );
  }

  // Chromium: trigger the native install prompt.
  return (
    <div
      role="dialog"
      aria-label="安装应用"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-lg font-bold text-white">
          π
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            安装「数学学习」
          </p>
          <p className="truncate text-xs text-gray-500">
            添加到主屏幕，离线也能学习
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭"
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="shrink-0 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {installing ? "安装中…" : "安装"}
        </button>
      </div>
    </div>
  );
}
