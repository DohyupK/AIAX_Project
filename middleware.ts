// 로그인 확인 — 로그인 안 하면 /login 으로 (JH/main/auth_gate, DH 승인 2026-11-21)
// 세션 서명 검증에 루트 .env AUTH_SECRET 사용. API 경로는 통과 (API 서버가 직접 검사)
import type { NextRequest } from "next/server";
import { authGate } from "@/JH/main/auth_gate";

export function middleware(req: NextRequest) {
  return authGate(req);
}

// 정적 파일(_next·확장자 있는 파일)은 검사하지 않음
export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
