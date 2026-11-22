"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "../../common/theme/ThemeToggle";
import { AUTH_PAGES } from "../../common/auth/token";
import { UserMenu } from "./UserMenu";
// 로고 — 펼침: 전체 로고(로그인 화면과 같은 파일) / PC 접힘: 원형 엠블럼만
import logo from "../../common/auth/shift-logo.png";
import emblem from "../../common/auth/shift-emblem.png";
import { openShiftHandover } from "../shift_handover/ShiftHandover";

type NavLeaf = { label: string; href: string };
// icon = 24x24 SVG path(d). 하위 메뉴가 있으면 href 없이 펼침 그룹
type NavItem = { label: string; icon: string; href?: string; children?: NavLeaf[] };

/** 알루미늄 공정 플랫폼 좌측 메뉴 — soft nav(next/link)로 전환 비용 절감 */
const NAV: NavItem[] = [
  {
    label: "주조 공정 대시보드",
    icon: "M2 20h20M4 20V10l6 4v-4l6 4V4h4v16",
    children: [
      { label: "공정 최적화", href: "/casting/process-optimization" },
      { label: "품질 검사", href: "/casting/quality-inspection" },
      { label: "불량 유형 라벨링", href: "/casting/defect-labeling" },
    ],
  },
  { label: "보호구 착용 위반 대시보드", href: "/safety/ppe-violation", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  {
    label: "인사 관리",
    href: "/hr",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  },
  { label: "경영 관리자 리포트", href: "/management-report", icon: "M3 3v18h18M7 16v-5M12 16V8M17 16v-8" },
  { label: "알루미늄 가격", href: "/al-price", icon: "M3 17l6-6 4 4 8-8M14 7h7v7" },
  {
    label: "Model Management",
    href: "/model-management",
    icon: "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3",
  },
];

// 사내 문서함 — 사이드바 하단 고정
const DOCS: NavItem = {
  label: "사내 문서함",
  href: "/documents",
  icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
};

// 인수인계 실행 — 페이지 이동 없이 전역 인수인계 팝업을 엶 (사내 문서함 바로 위)
const HANDOVER_ICON = "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3";

const SETTINGS_ICON =
  "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z";

const EXPANDED_KEY = "sidebar-expanded";

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** 로그인·회원가입 화면은 사이드바·헤더 없이 전체 화면 */
export function PlatformIndex() {
  const pathname = usePathname();
  return AUTH_PAGES.includes(pathname) ? null : <PlatformShell />;
}

/**
 * 셸 클라이언트 아일랜드 — 사이드바 + 상단 헤더(로그인 사용자·로그아웃).
 * PC(lg+): 펼침 256px ↔ 아이콘 80px (선택 저장) / 1024px 미만: 햄버거로 여는 서랍 + 어두운 뒤 배경
 */
function PlatformShell() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [castingOpen, setCastingOpen] = useState(() => pathname.startsWith("/casting"));

  // PC 접힘 상태 복원 — 저장 불가 환경이면 펼침 유지
  useEffect(() => {
    try {
      if (localStorage.getItem(EXPANDED_KEY) === "false") setExpanded(false);
    } catch (e) {
      console.warn("[sidebar] 접힘 상태 복원 실패", e);
    }
  }, []);

  // 페이지 이동 시 모바일 서랍 닫기
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Esc로 서랍 닫기 — 열려 있을 때만 리스너 등록
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function setExpandedSaved(next: boolean) {
    setExpanded(next);
    try {
      localStorage.setItem(EXPANDED_KEY, String(next));
    } catch (e) {
      console.warn("[sidebar] 접힘 상태 저장 실패", e);
    }
  }

  // PC 아이콘 모드에서 글자 숨김 (모바일 서랍은 항상 글자 표시)
  const label = expanded ? "" : "lg:hidden";

  function row(item: NavItem, active: boolean) {
    return (
      <span className="flex min-w-0 items-center gap-3">
        <Icon d={item.icon} className={active ? "text-brand-700 dark:text-brand-400" : "text-gray-400 dark:text-gray-500"} />
        <span className={`truncate text-sm font-medium ${label}`}>{item.label}</span>
      </span>
    );
  }

  function navItem(item: NavItem) {
    const active = item.href
      ? isActive(pathname, item.href)
      : (item.children ?? []).some((c) => isActive(pathname, c.href));
    const li = `rounded-lg py-2 pl-4 pr-3 ${
      active ? "bg-linear-to-r from-brand-700/[0.12] to-brand-700/[0.04] dark:from-brand-400/[0.2] dark:to-brand-400/[0.05]" : ""
    }`;
    const link = "block text-gray-800 transition hover:text-gray-900 dark:text-gray-100 dark:hover:text-white";

    if (item.href) {
      return (
        <li key={item.label} className={li}>
          <Link className={link} href={item.href} title={item.label} aria-current={active ? "page" : undefined}>
            {row(item, active)}
          </Link>
        </li>
      );
    }

    // 펼침 그룹 — 아이콘 모드에서 누르면 사이드바를 펼치고 그룹을 엶
    return (
      <li key={item.label} className={li}>
        <button
          type="button"
          className={`${link} flex w-full items-center justify-between text-left`}
          title={item.label}
          aria-expanded={castingOpen}
          onClick={() => {
            if (!expanded) {
              setExpandedSaved(true);
              setCastingOpen(true);
            } else setCastingOpen((v) => !v);
          }}
        >
          {row(item, active)}
          <svg
            className={`ml-2 size-3 shrink-0 fill-current text-gray-400 transition-transform dark:text-gray-500 ${castingOpen ? "rotate-180" : ""} ${label}`}
            viewBox="0 0 12 12"
            aria-hidden
          >
            <path d="M5.9 11.4L.5 6l1.4-1.4 4 4 4-4L11.3 6z" />
          </svg>
        </button>
        <ul className={`mt-1 pl-8 ${castingOpen ? "" : "hidden"} ${label}`}>
          {item.children?.map((c) => {
            const on = isActive(pathname, c.href);
            return (
              <li key={c.href}>
                <Link
                  href={c.href}
                  aria-current={on ? "page" : undefined}
                  className={`block truncate py-1.5 text-sm font-medium transition ${
                    on
                      ? "text-brand-700 dark:text-brand-400"
                      : "text-gray-500/90 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  return (
    <>
      {/* 모바일 뒤 배경 — 누르면 서랍 닫힘 */}
      <div
        className={`fixed inset-0 z-40 bg-gray-900/30 transition-opacity duration-200 lg:hidden ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden
      />

      <aside
        id="sidebar"
        aria-label="알루미늄 공정 플랫폼 메뉴"
        className={`fixed left-0 top-0 z-40 flex h-dvh w-64 shrink-0 flex-col overflow-y-auto bg-white p-4 shadow-sm transition-all duration-200 ease-in-out dark:bg-gray-800 lg:sticky lg:row-span-2 lg:translate-x-0 lg:rounded-r-2xl ${
          drawerOpen ? "translate-x-0" : "-translate-x-64"
        } ${expanded ? "lg:w-64" : "lg:w-20"}`}
      >
        {/* 로고 — 어느 페이지에서든 메인 대시보드로 복귀 */}
        <div className="mb-10 flex items-center justify-between pr-3 sm:px-2">
          <Link href="/" className="flex min-w-0 items-center" title="Shift — 메인 대시보드">
            <Image src={logo} alt="Shift — Aluminum Die Casting Platform" priority sizes="200px"
              className={`h-auto w-[200px] max-w-full rounded-lg ${label}`} />
            <Image src={emblem} alt="Shift" sizes="32px"
              className={`size-8 rounded-full object-cover ${expanded ? "hidden" : "hidden lg:block"}`} />{/* 원본 귀퉁이가 흰색 → 원형으로 잘라 원판만 */}
          </Link>
          <button
            type="button"
            className="p-1 text-gray-500 hover:text-gray-400 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-controls="sidebar"
            aria-label="메뉴 닫기"
          >
            <svg className="size-6 fill-current" viewBox="0 0 24 24" aria-hidden>
              <path d="M10.7 18.7l1.4-1.4L7.8 13H20v-2H7.8l4.3-4.3-1.4-1.4L4 12z" />
            </svg>
          </button>
        </div>

        <nav>
          <h3 className="pl-3 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
            <span className={expanded ? "hidden" : "hidden w-6 text-center lg:block"} aria-hidden>
              •••
            </span>
            <span className={label}>메뉴</span>
          </h3>
          <ul className="mt-3 space-y-1">{NAV.map(navItem)}</ul>
        </nav>

        {/* 하단 고정: 인수인계 실행 · 사내 문서함 · 설정(표시만) · PC 접기 버튼 */}
        <div className="mt-auto pt-6">
          <ul className="space-y-1">
            <li className="rounded-lg py-2 pl-4 pr-3">
              <button
                type="button"
                className="block w-full text-left text-gray-800 transition hover:text-gray-900 dark:text-gray-100 dark:hover:text-white"
                title="인수인계 실행"
                aria-haspopup="dialog"
                onClick={() => {
                  setDrawerOpen(false);
                  openShiftHandover();
                }}
              >
                {row({ label: "인수인계 실행", icon: HANDOVER_ICON }, false)}
              </button>
            </li>
            {navItem(DOCS)}
          </ul>
          <div className={`mt-3 flex gap-3 px-3 ${expanded ? "items-center justify-between" : "items-center justify-between lg:flex-col lg:px-0"}`}>
            <span className="text-gray-400 dark:text-gray-500" role="img" aria-label="설정">
              <Icon d={SETTINGS_ICON} />
            </span>
            <button
              type="button"
              className="hidden rounded-md p-1 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 lg:inline-flex"
              onClick={() => setExpandedSaved(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? "사이드바 접기" : "사이드바 펼치기"}
              title={expanded ? "사이드바 접기" : "사이드바 펼치기"}
            >
              <svg className={`size-6 fill-current ${expanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" aria-hidden>
                <path d="M19.586 11l-5-5L16 4.586 23.414 12 16 19.414 14.586 18l5-5H7v-2h12.586z" />
                <path d="M3 23H1V1h2z" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* 상단 헤더 — 스크롤해도 고정 */}
      <header className="sticky top-0 z-30 before:absolute before:inset-0 before:-z-10 before:bg-white/90 before:backdrop-blur-md max-lg:shadow-sm dark:before:bg-gray-800/90 lg:col-start-2 lg:row-start-1 lg:before:bg-gray-100/90 dark:lg:before:bg-gray-900/90">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:border-b lg:border-gray-200 lg:px-8 dark:lg:border-gray-700/60">
          <button
            type="button"
            className="-ml-1 p-1 text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-controls="sidebar"
            aria-expanded={drawerOpen}
            aria-label="메뉴 열기"
          >
            <svg className="size-6 fill-current" viewBox="0 0 24 24" aria-hidden>
              <rect x="4" y="5" width="16" height="2" />
              <rect x="4" y="11" width="16" height="2" />
              <rect x="4" y="17" width="16" height="2" />
            </svg>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  );
}
