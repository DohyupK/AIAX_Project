import { PlatformIndex } from "./PlatformIndex";
import styles from "./PlatformIndex.module.css";

/** 서버 셸: 사이드바만 클라이언트 아일랜드, 본문(children)은 RSC 유지 */
export function PlatformLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <PlatformIndex />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
