"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const DISMISS_KEY = "review-reminder-dismissed";

/** Today's date as YYYY-MM-DD, used for the daily dismissal key. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True when the app is running as an installed PWA (standalone display mode). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/** Convert a VAPID public key from base64url to the Uint8Array PushManager expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe the current service worker to Web Push and POST the subscription
 * to the server. Only call this for installed PWA users (standalone mode) so
 * we don't attempt push for non-PWA browsers where it would fail.
 *
 * Best-effort: any error is swallowed by the caller.
 */
async function subscribeToPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window)) return;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

export function ReminderBanner() {
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const pushAttempted = useRef(false);

  const { data } = useQuery({
    queryKey: ["review-due-count"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) return 0;
      const json = (await res.json()) as { dueCount?: number };
      return json.dueCount ?? 0;
    },
    staleTime: 60_000,
  });

  // Hydrate the dismissal state from localStorage (client-only).
  useEffect(() => {
    setHydrated(true);
    setDismissed(localStorage.getItem(DISMISS_KEY) === todayKey());
  }, []);

  // Attempt Web Push subscription once for installed PWA users with due items.
  useEffect(() => {
    if (pushAttempted.current) return;
    if (!hydrated || dismissed) return;
    if (!isStandalone()) return;
    const count = data ?? 0;
    if (count <= 0) return;
    pushAttempted.current = true;
    void subscribeToPush().catch(() => {
      // Push subscription is best-effort; silently ignore failures.
    });
  }, [hydrated, dismissed, data]);

  const count = data ?? 0;
  if (!hydrated || dismissed || count <= 0) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, todayKey());
    setDismissed(true);
  }

  return (
    <div className="sticky top-0 z-40 bg-blue-600 text-white shadow-md">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <span className="min-w-0 flex-1 text-sm font-medium">
          你有 <strong className="font-bold">{count}</strong> 个知识点待复习
        </span>
        <Link
          href="/review"
          className="shrink-0 rounded-md bg-white px-3 py-1 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
        >
          开始复习
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="关闭"
          className="shrink-0 rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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
    </div>
  );
}
