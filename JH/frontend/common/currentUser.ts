'use client';
// 현재 로그인 계정 — 업로더 등 "누가 했는지" 표시에 사용. /api/auth/me 를 한 번만 불러와 캐시 (권한 판단은 서버가 세션으로)
import { useEffect, useState } from 'react';
import { fetchMe, type Me } from './auth/authApi';

export interface CurrentUser {
  user_id: string;    // 사번 (문서 업로더 기록·비교용)
  name: string;
  admin: boolean;
}

let cached: CurrentUser | null = null;
let pending: Promise<CurrentUser | null> | null = null;

// 관리자는 org 사번이 없어 서버와 같은 기본 사번 e0001 로 기록 (JH/api/documents/router._resolve_uploader)
const toUser = (m: Me): CurrentUser => ({ user_id: m.employeeNo ?? 'e0001', name: m.name, admin: m.admin });

/** 로그인 사용자 (첫 호출만 서버 조회, 실패·미로그인 = null) */
export function loadCurrentUser(): Promise<CurrentUser | null> {
  if (cached) return Promise.resolve(cached);
  return (pending ??= fetchMe()
    .then((m) => (cached = m ? toUser(m) : null))
    .finally(() => { pending = null; }));
}


/** 화면용 — 불러오면 다시 그림 */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  useEffect(() => {
    let alive = true;
    loadCurrentUser().then((u) => alive && setUser(u));
    return () => { alive = false; };
  }, []);
  return user;
}
