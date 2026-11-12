import type { Metadata } from "next";
import "./globals.css";
// 화면 셸: JH 플랫폼 인덱스 (DH 승인 2026-11-06, 기존 AppShell은 components/에 보존)
import { PlatformLayout } from "@/JH/main";

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
    <html lang="ko">
      <body>
        <PlatformLayout>{children}</PlatformLayout>
      </body>
    </html>
  );
}
