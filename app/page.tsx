import styles from "@/app/page.module.css";

/** 루트 메인 랜딩 — 기능 로직 없음(플레이스홀더) */
export default function HomePage() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>TeamProject</p>
      <h1 className={styles.title}>제조 AX 워크스페이스</h1>
      <p className={styles.lead}>
        왼쪽 사이드바에서 팀 카테고리를 선택합니다. 개별 기능은 각 담당 폴더에서
        개발·등록된 뒤 이 셸에 연결됩니다.
      </p>
      <div className={styles.pillRow}>
        <span className={styles.pill}>거버넌스 준비됨</span>
        <span className={styles.pill}>기능 연동 대기</span>
      </div>
    </section>
  );
}
