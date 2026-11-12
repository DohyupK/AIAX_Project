"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./ModelManagement.module.css";
import { PROCESS, type Metrics, type Model, type Process } from "./data";
import { validateDraft, type Draft, type Errors } from "./logic";

// 서버 연동 전: 파일은 이름만 기록 (실제 업로드 없음)
const ALLOWED_EXT = [".pkl", ".pt", ".onnx", ".joblib"];
const METRIC_FIELDS: { key: keyof Metrics; label: string }[] = [
  { key: "accuracy", label: "Accuracy" },
  { key: "recall", label: "Recall" },
  { key: "precision", label: "Precision" },
  { key: "f1", label: "F1-Score" },
];

const EMPTY: Draft = { name: "", version: "", createdAt: "", process: "", description: "", accuracy: "", recall: "", precision: "", f1: "" };

/** 모델 등록 팝업 — 등록 시 onSubmit(새 모델, id 제외) */
export default function ModelForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (m: Omit<Model, "id">) => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const firstRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 열릴 때 한 번만 첫 칸에 포커스
  useEffect(() => firstRef.current?.focus(), []);

  // Esc로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key: keyof Draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
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
    const found = validateDraft(draft, PROCESS);
    if (Object.keys(found).length) return setErrors(found);
    onSubmit({
      name: draft.name.trim(),
      version: draft.version.trim(),
      createdAt: draft.createdAt,
      process: draft.process as Process,
      description: draft.description.trim(),
      metrics: { accuracy: Number(draft.accuracy), recall: Number(draft.recall), precision: Number(draft.precision), f1: Number(draft.f1) },
      applyCount: 0,
      deployed: false,
      fileName: fileName || undefined,
    });
  }

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

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>모델명 *</span>
            <input ref={firstRef} value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
            {err("name")}
          </label>
          <label className={styles.field}>
            <span>버전 *</span>
            <input value={draft.version} onChange={(e) => set("version", e.target.value)} placeholder="v1.0" maxLength={20} />
            {err("version")}
          </label>
          <label className={styles.field}>
            <span>생성일 *</span>
            <input type="date" value={draft.createdAt} onChange={(e) => set("createdAt", e.target.value)} />
            {err("createdAt")}
          </label>
          <label className={styles.field}>
            <span>관리공정 *</span>
            <select value={draft.process} onChange={(e) => set("process", e.target.value)}>
              <option value="">선택</option>
              {(Object.keys(PROCESS) as Process[]).map((p) => (
                <option key={p} value={p}>{PROCESS[p].label} ({PROCESS[p].code})</option>
              ))}
            </select>
            {err("process")}
          </label>
          <label className={`${styles.field} ${styles.full}`}>
            <span>설명</span>
            <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={200} />
          </label>
        </div>

        <fieldset className={styles.metricSet}>
          <legend>성과지표 * (0~1)</legend>
          {METRIC_FIELDS.map(({ key, label }) => (
            <label key={key} className={styles.field}>
              <span>{label}</span>
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

        <div className={styles.dialogActions}>
          <button type="button" className={styles.btn} onClick={onClose}>취소</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>등록</button>
        </div>
      </form>
    </div>
  );
}
