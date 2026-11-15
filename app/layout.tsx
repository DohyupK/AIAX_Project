import type { Metadata } from "next";
import "./globals.css";
// 화면 셸: JH 플랫폼 인덱스 (서버 PlatformLayout + 클라이언트 사이드바 아일랜드)
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
