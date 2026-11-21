import type { NextConfig } from "next";

// 루트 Next 셸 — 개인 폴더(JH~DH) 소스는 앱 라우트에 직접 묶지 않음
// Al 시세: app/al-price/api/prices/route.ts → :8766 (nginx /api/ 와 분리)
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 개발 중 좌측 하단 Route Static N 배지 숨김 (에러 오버레이는 유지) — JH 요청 2026-11-21
  devIndicators: false,
  // F12 콘솔에 앱 로그가 남지 않도록 빌드 산출물에서 console.* 제거
  compiler: {
    removeConsole: true,
  },
  // 로그인 세션 쿠키는 화면과 같은 주소여야 함 → 로컬 개발은 /api 를 JH API 로 넘김 (DH 승인 2026-11-21)
  // 배포 서버는 nginx 가 /api 를 바로 JH API 로 보내므로 JH_API_ORIGIN 을 비워 둠 (이 설정 미사용)
  async rewrites() {
    const origin = process.env.JH_API_ORIGIN;
    return origin ? [{ source: "/api/:path*", destination: `${origin}/api/:path*` }] : [];
  },
};

export default nextConfig;
