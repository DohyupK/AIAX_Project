// 페이지 접근 문지기 — 루트 middleware.ts 가 JH/main/auth_gate 로 호출
// 로그인 안 함 → /login?next=원래주소 / 로그인함 + /login·/signup → 메인
// API(/api/…, …/api/…)는 통과 — API 서버가 직접 세션 검사 (리다이렉트 HTML 을 받으면 화면 fetch 가 깨짐)
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_PAGES, SESSION_COOKIE, isValidSession } from './token';

export async function authGate(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/') || pathname.includes('/api/')) return NextResponse.next();

  const loggedIn = await isValidSession(req.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET);
  const authPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (loggedIn && authPage) return NextResponse.redirect(new URL('/', req.url));
  if (!loggedIn && !authPage) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
