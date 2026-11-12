"use client";

import { useState } from "react";
import styles from "./PlatformIndex.module.css";

type IndexItem = { label: string; href: string };
type IndexSection = { title: string; href?: string; items: IndexItem[] };

/** 알루미늄 공정 플랫폼 좌측 인덱스 — 공정 최적화·작업자 안전만 실제 경로, 나머지 링크는 자리(#) */
const SECTIONS: IndexSection[] = [
  {
    title: "주조 공정 대시보드",
    items: [
      { label: "공정 최적화", href: "/casting/process-optimization" },
      { label: "품질 검사", href: "#casting-quality-inspection" },
    ],
  },
  { title: "작업자 안전 관리 대시보드", href: "/safety/worker-safety", items: [] },
  { title: "경영 관리자 일일경영리포트", items: [] },
  { title: "Model Management", href: "/model-management", items: [] },
];

export function PlatformIndex() {
  // 접힘 상태 — 저장하지 않음 (페이지 이동 시 펼침으로 초기화)
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
      aria-label="알루미늄 공정 플랫폼 인덱스"
    >
      <div className={styles.header}>
        {!collapsed && (
          <p className={styles.title}>
            {/* 어느 페이지에서든 메인 대시보드로 복귀 */}
            <a className={styles.link} href="/">
              알루미늄 공정 플랫폼
            </a>
          </p>
        )}
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {/* 패널 아이콘 — 열림: 왼쪽 칸 채움(강조색) / 닫힘: 구분선만 */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden>
            {collapsed ? (
              <path d="M10 4v16" />
            ) : (
              <path className={styles.toggleFill} d="M10 4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h4z" />
            )}
            <rect x="3" y="4" width="18" height="16" rx="3" />
          </svg>
        </button>
      </div>
      {!collapsed && <nav>
        {SECTIONS.map((section) => (
          <div key={section.title} className={styles.section}>
            <p className={styles.sectionTitle}>
              {section.href ? (
                <a className={styles.link} href={section.href}>
                  {section.title}
                </a>
              ) : (
                section.title
              )}
            </p>
            {section.items.length > 0 && (
              <ul className={styles.list}>
                {section.items.map((item) => (
                  <li key={item.label} className={styles.item}>
                    <a className={styles.link} href={item.href}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>}
      {/* 설정 아이콘 — 표시만 (클릭 동작은 이후 기능) */}
      {!collapsed && (
        <span className={styles.settings} role="img" aria-label="설정">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </span>
      )}
    </aside>
  );
}

/** 인덱스 + 회색 본문 레이아웃 */
export function PlatformLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <PlatformIndex />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
