import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ReminderBanner } from "@/components/notifications/ReminderBanner";
import { BottomNav } from "@/components/layout/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "K12 学习平台",
  description: "K12 学习平台 - 知识管理、错题本与复习系统",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "数学学习",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <ReminderBanner />
          {/* pb-16 为移动端 BottomNav 留空间，桌面端 lg:pb-0 */}
          <div className="flex-1 pb-16 lg:pb-0">{children}</div>
        </Providers>
        <InstallPrompt />
        <BottomNav />
      </body>
    </html>
  );
}
