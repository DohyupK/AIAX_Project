"use client";

import { useEffect, useState } from "react";
import {
  fetchDocPreviewBlobUrl,
  fetchDocText,
  fileInlineUrl,
  viewModeOf,
} from "./docView";
import s from "./HyejinBot.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "text"; text: string; truncated: boolean }
  | { kind: "iframe"; url: string }
  | { kind: "image"; url: string }
  | { kind: "none"; message: string }
  | { kind: "error"; message: string };

export default function DocPreviewModal({
  idx,
  title,
  fileName,
  onClose,
}: {
  idx: number;
  title: string;
  fileName: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    async function load() {
      setState({ kind: "loading" });
      const mode = viewModeOf(fileName);
      try {
        if (mode === "text") {
          const t = await fetchDocText(idx);
          if (!cancelled) setState({ kind: "text", text: t.text, truncated: t.truncated });
          return;
        }
        if (mode === "pdf") {
          if (!cancelled) setState({ kind: "iframe", url: fileInlineUrl(idx) });
          return;
        }
        if (mode === "image") {
          if (!cancelled) setState({ kind: "image", url: fileInlineUrl(idx) });
          return;
        }
        if (mode === "convert") {
          try {
            const url = await fetchDocPreviewBlobUrl(idx);
            revoked = url;
            if (!cancelled) setState({ kind: "iframe", url });
          } catch {
            const t = await fetchDocText(idx);
            if (!cancelled) setState({ kind: "text", text: t.text, truncated: t.truncated });
          }
          return;
        }
        if (!cancelled) {
          setState({ kind: "none", message: "이 형식은 미리보기를 지원하지 않습니다." });
        }
      } catch (e) {
        if (!cancelled) setState({ kind: "error", message: (e as Error).message });
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [idx, fileName]);

  return (
    <div className={s.previewBackdrop} role="presentation" onClick={onClose}>
      <div
        className={s.previewModal}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} 원문`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.previewHead}>
          <div className={s.previewTitle}>
            <strong>{title || fileName}</strong>
            <span className={s.previewFile}>{fileName}</span>
          </div>
          <button type="button" className={s.closeBtn} aria-label="미리보기 닫기" onClick={onClose}>
            ×
          </button>
        </header>
        <div className={s.previewBody}>
          {state.kind === "loading" && <p className={s.previewMuted}>불러오는 중…</p>}
          {state.kind === "error" && <p className={s.errorBox}>{state.message}</p>}
          {state.kind === "none" && <p className={s.previewMuted}>{state.message}</p>}
          {state.kind === "text" && (
            <>
              {state.truncated && (
                <p className={s.previewMuted}>앞부분만 표시합니다. 전체는 문서함에서 확인하세요.</p>
              )}
              <pre className={s.previewText}>{state.text || "(본문 없음)"}</pre>
            </>
          )}
          {state.kind === "iframe" && (
            <iframe className={s.previewFrame} title={title} src={state.url} />
          )}
          {state.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.previewImg} src={state.url} alt={title} />
          )}
        </div>
      </div>
    </div>
  );
}
