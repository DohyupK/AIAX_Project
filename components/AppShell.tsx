import { Sidebar } from "@/components/Sidebar";
import styles from "@/components/AppShell.module.css";

/** 루트 메인 셸: 좌측 사이드바 + 본문 (개인 폴더 기능은 이후 등록·연동) */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.mainColumn}>
        <header className={styles.topBar} aria-label="상단 바">
          <span className={styles.topBarHint}>TeamProject</span>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
