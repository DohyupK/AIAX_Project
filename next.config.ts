import type { NextConfig } from "next";

// 루트 Next 셸 — 개인 폴더(JH~DH) 소스는 앱 라우트에 직접 묶지 않음
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 브라우저 → /api/al-price/* → DH aluminum_price serve(:8766)
  async rewrites() {
    return [
      {
        source: "/api/al-price/:path*",
        destination: "http://127.0.0.1:8766/:path*",
      },
    ];
  },
};

export default nextConfig;
