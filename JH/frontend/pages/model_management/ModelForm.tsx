"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./ModelManagement.module.css";
import { METRIC_LABEL, PROCESS, PROCESS_METRICS, type Process } from "./data";
import { validateDraft, type Draft, type Errors } from "./logic";

// 파일은 이름만 확인 (실제 업로드 없음 — 서버 저장 폴더는 DH 결정)
const ALLOWED_EXT = [".pkl", ".pt", ".onnx", ".joblib"];
// ponytail: ai 쓰기 계정(MS) 전이라 저장 안 함 — 입력 검사만. 계정이 생기면 submit 에서 POST /api/models 호출
const SAVE_BLOCKED = "DB 쓰기 계정 연결 전이라 아직 저장할 수 없습니다. 입력값 검사만 했습니다.";

const EMPTY: Draft = { name: "", version: "", process: "", description: "", accuracy: "", prAuc: "", map50: "", recall: "", precision: "", f1: "" };

/**
 * 모델 등록 팝업 — 지금은 입력 검사까지 (DB 저장은 쓰기 계정 연결 후)
 * process: 공정 탭에서 열면 그 관리공정으로 고정 (전체 탭에서 열면 직접 선택)
 */
export default function ModelForm({ process, onClose }: { process?: Process; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, process: process ?? "" });
  const [blocked, setBlocked] = useState(false);
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const firstRef = useRef<HTMLSelectElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 열릴 때 한 번만 첫 입력 칸에 포커스 (공정이 정해져 있으면 모델명)
  useEffect(() => (process ? nameRef.current : firstRef.current)?.focus(), [process]);

  // Esc로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key: keyof Draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setBlocked(false);
  };

  function onFile(file: File | undefined) {
    if (!file) return setFileName("");
    // accept 속성은 우회 가능하므로 확장자를 다시 확인
    if (!ALLOWED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setFileName("");
      setErrors((e) => ({ ...e, file: `${ALLOWED_EXT.join(" ")} 파일만 가능합니다` }));
      return;
    }
    setFileName(file.name);
    setErrors((e) => ({ ...e, file: undefined }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateDraft(draft, PROCESS, PROCESS_METRICS);
    if (Object.keys(found).length) return setErrors(found);
    setBlocked(true);
  }

  const prefix = Object.hasOwn(PROCESS, draft.process) ? PROCESS[draft.process as Process].prefix : "";
  const err = (key: keyof Errors) => errors[key] && <span className={styles.fieldError}>{errors[key]}</span>;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-form-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <div className={styles.dialogHead}>
          <h2 id="model-form-title" className={styles.dialogTitle}>모델 등록</h2>
          <button type="button" className={styles.closeBtn} aria-label="닫기" onClick={onClose}>×</button>
        </div>

        <div className={`${styles.formGrid} ${styles.formGrid3}`}>
          <label className={styles.field}>
            <span>관리공정 *</span>
            <select ref={firstRef} value={draft.process} onChange={(e) => set("process", e.target.value)} disabled={!!process}
              title={process ? "공정 탭에서 열어 관리공정이 정해져 있습니다" : undefined}>
              <option value="">선택</option>
              {(Object.keys(PROCESS) as Process[]).map((p) => (
                <option key={p} value={p}>{PROCESS[p].label} ({PROCESS[p].code})</option>
              ))}
            </select>
            {err("process")}
          </label>
          <label className={styles.field}>
            <span>모델명 *</span>
            {/* 공정별 앞부분(DieCasting_ / PPE_) + 알고리즘 — 날짜·순번은 등록 시 자동 */}
            <span className={styles.prefixInput}>
              {prefix && <span className={styles.prefix}>{prefix}_</span>}
              <input
                ref={nameRef}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                disabled={!prefix}
                placeholder={prefix ? PROCESS[draft.process as Process].algoHint : "관리공정을 먼저 선택"}
                aria-label={prefix ? `모델명 (${prefix}_ 뒤 알고리즘)` : undefined}
                maxLength={30}
              />
            </span>
            {err("name")}
          </label>
          <label className={styles.field}>
            <span>버전 *</span>
            <input value={draft.version} onChange={(e) => set("version", e.target.value)} placeholder="v1.0" maxLength={20} />
            {err("version")}
          </label>
          <label className={`${styles.field} ${styles.full}`}>
            <span>설명</span>
            <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={200} />
          </label>
        </div>

        <fieldset className={styles.metricSet}>
          <legend>성과지표 * (0~1)</legend>
          {/* 지표 종류는 고른 공정에 따라 다름 (공정 선택 전엔 Accuracy 기준 목록으로 표시) */}
          {PROCESS_METRICS[Object.hasOwn(PROCESS, draft.process) ? (draft.process as Process) : "qc2"].map((key) => (
            <label key={key} className={styles.field}>
              <span>{METRIC_LABEL[key]}</span>
              <input type="number" inputMode="decimal" min={0} max={1} step={0.001} value={draft[key]} onChange={(e) => set(key, e.target.value)} />
              {err(key)}
            </label>
          ))}
        </fieldset>

        <div className={styles.fileRow}>
          <button type="button" className={styles.btn} onClick={() => fileRef.current?.click()}>
            파일 업로드
          </button>
          <input ref={fileRef} type="file" accept={ALLOWED_EXT.join(",")} onChange={(e) => onFile(e.target.files?.[0])} hidden />

          <span className={styles.muted}>{fileName || `${ALLOWED_EXT.join(" ")} (선택)`}</span>
          {err("file")}
        </div>

        {blocked && <p className={styles.fieldError} role="status">{SAVE_BLOCKED}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.btn} onClick={onClose}>취소</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>등록</button>
        </div>
      </form>
    </div>
  );
}
