"use client";

import { useRef, useState } from "react";
import { askShiftBot } from "./chatApi";
import type { ChatTurn } from "./sources";
import s from "./HyejinBot.module.css";

/**
 * Shift 봇 — 전역 우하단 FAB (app/layout).
 * JH /api/documents/ask: 사내 문서 + 관리도 알림 + Chat
 */
export default function HyejinBot() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text || busy) return;
    setError(null);
    setQ("");
    setTurns((t) => [...t, { role: "user", content: text, sources: [] }]);
    setBusy(true);
    try {
      const res = await askShiftBot(text);
      setTurns((t) => [...t, { role: "assistant", content: res.answer, sources: res.sources }]);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.page}>
      {open && (
        <div className={s.panel} role="dialog" aria-label="Shift 채팅">
          <header className={s.panelHead}>
            <div>
              <div className={s.panelTitle}>Shift</div>
              <p className={s.panelSub}>사내 문서·관리도 알림을 근거로 답합니다</p>
            </div>
            <button
              type="button"
              className={s.closeBtn}
              aria-label="Shift 닫기"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          {error && (
            <div className={s.errorBox} role="alert">
              {error}
            </div>
          )}

          <div className={s.thread} aria-live="polite">
            {turns.length === 0 && (
              <p className={s.empty}>문서함·공정 관리도 알림을 검색해 답합니다.</p>
            )}
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <div key={i} className={s.bubbleUser}>
                  {turn.content}
                </div>
              ) : (
                <div key={i} className={s.bubbleBot}>
                  <div className={s.botLabel}>Shift</div>
                  <p className={s.answer}>{turn.content}</p>
                  {turn.sources.length > 0 && (
                    <ul className={s.sources} aria-label="출처">
                      {turn.sources.map((src) => (
                        <li key={`${src.kind}-${src.doc_no}-${src.chunk_no}-${src.file_name}`}>
                          <div className={s.srcTitle}>
                            {src.doc_no} · {src.title}
                          </div>
                          <div className={s.srcMeta}>
                            {src.kind === "process_alert" ? (
                              <>
                                관리도 알림
                                {src.category ? ` · ${src.category}` : ""}
                                {src.file_name ? ` · ${src.file_name}` : ""}
                              </>
                            ) : src.kind === "quality_kpi" ? (
                              <>
                                품질 검사 KPI
                                {src.line ? ` · ${src.line}` : ""}
                                {src.file_name ? ` · ${src.file_name}` : ""}
                              </>
                            ) : (
                              <>
                                {src.file_name}
                                {src.category ? ` · ${src.category}` : ""} · chunk {src.chunk_no} ·
                                score {src.score}
                              </>
                            )}
                          </div>
                          {src.snippet && <p className={s.snippet}>{src.snippet}</p>}
                          {src.kind === "company_document" && src.file_url ? (
                            <a className={s.fileLink} href={src.file_url} target="_blank" rel="noreferrer">
                              원문 다운로드
                            </a>
                          ) : src.kind === "process_alert" ? (
                            <a className={s.fileLink} href="/casting/process-optimization">
                              공정 최적화 · 관리도 알림
                            </a>
                          ) : src.kind === "quality_kpi" ? (
                            <a className={s.fileLink} href="/casting/quality-inspection">
                              품질 검사 대시보드
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
            )}
            <div ref={bottomRef} />
          </div>

          <form className={s.form} onSubmit={onSubmit}>
            <input
              className={s.input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="문서·관리도 알림에 대해 질문하세요"
              aria-label="Shift 질문"
              disabled={busy}
            />
            <button type="submit" className={s.send} disabled={busy || !q.trim()}>
              {busy ? "답변 중…" : "보내기"}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className={s.fab}
        aria-label={open ? "Shift 닫기" : "Shift 열기"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "×" : "S"}
      </button>
    </div>
  );
}
