import styles from "@/components/Sidebar.module.css";

/** 사이드바 카테고리 — 이후 page_registry 연동 전, 팀 폴더 자리만 표시 */
const CATEGORIES = [
  { id: "JH", label: "JH", href: "#JH" },
  { id: "HJ", label: "HJ", href: "#HJ" },
  { id: "TM", label: "TM", href: "#TM" },
  { id: "MS", label: "MS", href: "#MS" },
  { id: "DH", label: "DH", href: "#DH" },
] as const;

export function Sidebar() {
  return (
    <aside className={styles.sidebar} aria-label="메인 사이드바">
      <div className={styles.brand}>
        {/* 공식 로고 이미지 미사용 — CSS 마크 + 텍스트 (상표 이미지 비배포) */}
        <span className={styles.brandMark} aria-hidden>
          H
        </span>
        <span className={styles.brandText}>HYUNDAI</span>
      </div>

      <p className={styles.sectionLabel}>카테고리</p>
      <nav className={styles.nav}>
        <ul className={styles.list}>
          {CATEGORIES.map((item) => (
            <li key={item.id}>
              <a className={styles.link} href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <p className={styles.footerNote}>
        기능 등록은 루트 page_registry.md
      </p>
    </aside>
  );
}
