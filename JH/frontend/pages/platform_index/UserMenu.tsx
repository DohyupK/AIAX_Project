"use client";

import { useState } from "react";
import { logout } from "../../common/auth/authApi";
import { useCurrentUser } from "../../common/currentUser";

/** 헤더 오른쪽 — 로그인한 이름(관리자 배지) + 로그아웃. 폰은 이름 첫 글자만 */
export function UserMenu() {
  const user = useCurrentUser();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
    } catch (e) {
      // 서버 연결 실패여도 화면은 로그인으로 — 쿠키가 남아 있으면 로그인 화면이 다시 메인으로 보냄
      console.error("[auth] 로그아웃 요청 실패", e);
    }
    window.location.replace("/login");
  }

  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      <hr className="h-6 w-px border-none bg-gray-200 dark:bg-gray-700/60" />
      <div className="flex items-center gap-2 text-sm">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700 dark:bg-brand-400/20 dark:text-brand-400"
          aria-hidden
        >
          {user.name[0]}
        </span>
        {/* 관리자는 이름도 「관리자」라 배지만 */}
        {!user.admin && <span className="font-medium text-gray-800 max-sm:hidden dark:text-gray-100">{user.name}</span>}
        {user.admin && (
          <span className="rounded-full bg-brand-700/10 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-400/20 dark:text-brand-400">
            관리자
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onLogout}
        disabled={busy}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition hover:border-gray-300 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60 dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-300 max-sm:px-2.5 max-sm:py-2"
      >
        로그아웃
      </button>
    </div>
  );
}
