"use client";
import { useEffect } from "react";
import styles from "./ModelManagement.module.css";
import type { Model, RobustnessRow } from "./data";
import { averageRobustness } from "./logic";

const KEYS = ["accuracy", "recall", "precision", "f1"] as const;
const num4 = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(4));

/**
 * 강건성 팝업 (품질 2차) — 원본 = 모델 성과지표(ai.model_metric_cast_qc2), 조건별 = ai.model_robustness
 * 조회는 화면(ModelManagement)이 모델 선택 때 한 번 — Overview 괄호 평균과 같은 데이터. rows null = 불러오는 중
 */
export default function RobustnessDialog({ model, rows, error, onClose }: {
  model: Model; rows: RobustnessRow[] | null; error: string; onClose: () => void;
}) {
  // Esc로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const avg = rows && averageRobustness(rows);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={`${styles.dialog} ${styles.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="robustness-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dialogHead}>
          <h2 id="robustness-title" className={styles.dialogTitle}>
            강건성 <span className={styles.muted}>{model.name} {model.version}</span>
          </h2>
          <button type="button" className={styles.closeBtn} aria-label="닫기" onClick={onClose}>×</button>
        </div>

        {rows === null ? (
          <p className={styles.muted}>불러오는 중…</p>
        ) : error ? (
          <p className={styles.fieldError} role="alert">{error}</p>
        ) : rows.length === 0 ? (
          <p className={styles.muted}>등록된 강건성 데이터가 없습니다. (서버 DB ai.model_robustness)</p>
        ) : (
          <>
            <div className={styles.robustScroll}>
            <table className={styles.robustTable}>
              <thead>
                <tr><th>조건</th>{KEYS.map((k) => <th key={k}>{k}</th>)}</tr>
              </thead>
              <tbody>
                <tr className={styles.robustStrong}>
                  <td>원본</td>{KEYS.map((k) => <td key={k}>{num4(model.metrics[k])}</td>)}
                </tr>
                <tr className={styles.robustStrong}>
                  <td>조건 평균 ({rows.length}개)</td>{KEYS.map((k) => <td key={k}>{num4(avg?.[k])}</td>)}
                </tr>
                {rows.map((r) => (
                  <tr key={r.condition}>
                    <td>{r.condition}</td>{KEYS.map((k) => <td key={k}>{num4(r[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <ul className={styles.robustNote}>
              <li>원본: 손상을 주지 않은 사진의 평가지표입니다. (Overview 성과지표와 같은 값)</li>
              <li>조건 평균: {rows.length}개 손상 조건 값의 단순 평균이며, 원본은 포함하지 않습니다.</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
