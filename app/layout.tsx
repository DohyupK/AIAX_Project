import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 화면 셸: JH 플랫폼 인덱스 (서버 PlatformLayout + 클라이언트 사이드바·헤더 아일랜드) + 다크 모드 스크립트
import { PlatformLayout, ThemeScript } from "@/JH/main";
// 교대 인수인계 — 전역 팝업·「인수인계 실행」(JH, DH 마운트)
import { ShiftHandover } from "@/JH/main/shift_handover";
// Shift 봇 — 전역 우하단 FAB (DH, 모듈 id hyejin_bot)
import { HyejinBot } from "@/DH/main/hyejin_bot";

// Inter — next/font가 빌드 시 받아 자체 호스팅 (패키지 추가 아님). 한글은 globals.css 대체 폰트
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "TeamProject",
  description: "팀 제조 AX — 사이드바 메인 셸",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: ThemeScript가 hydration 전에 <html class="dark">를 붙이기 때문
    <html lang="ko" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="bg-gray-100 font-sans text-gray-600 antialiased dark:bg-gray-900 dark:text-gray-400">
        <PlatformLayout>{children}</PlatformLayout>
        <ShiftHandover />
        <HyejinBot />
      </body>
    </html>
  );
}
