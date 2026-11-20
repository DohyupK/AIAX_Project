import type { NextConfig } from "next";

// 루트 Next 셸 — 개인 폴더(JH~DH) 소스는 앱 라우트에 직접 묶지 않음
// Al 시세: app/al-price/api/prices/route.ts → :8766 (nginx /api/ 와 분리)
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
