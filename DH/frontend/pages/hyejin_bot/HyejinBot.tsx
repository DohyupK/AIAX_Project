"use client";

import { useRef, useState } from "react";
import { askHyejinBot } from "./chatApi";
import type { ChatTurn } from "./sources";
import s from "./HyejinBot.module.css";

/**
 * 혜진봇 Phase B — 전역 우하단 FAB + 패널 (app/layout 마운트).
 * JH /api/documents/ask (OpenAI Chat + 출처). casting은 sources.ts stub
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
      const res = await askHyejinBot(text);
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
        <div className={s.panel} role="dialog" aria-label="혜진봇 채팅">
          <header className={s.panelHead}>
            <div>
              <div className={s.panelTitle}>혜진봇</div>
              <p className={s.panelSub}>사내 문서 근거로 답합니다</p>
            </div>
            <button
              type="button"
              className={s.closeBtn}
              aria-label="혜진봇 닫기"
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
              <p className={s.empty}>질문을 입력하면 사내 문서를 검색해 답합니다.</p>
            )}
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <div key={i} className={s.bubbleUser}>
                  {turn.content}
                </div>
              ) : (
                <div key={i} className={s.bubbleBot}>
                  <div className={s.botLabel}>혜진봇</div>
                  <p className={s.answer}>{turn.content}</p>
                  {turn.sources.length > 0 && (
                    <ul className={s.sources} aria-label="출처">
                      {turn.sources.map((src) => (
                        <li key={`${src.kind}-${src.company_document_idx}-${src.chunk_no}`}>
                          <div className={s.srcTitle}>
                            {src.doc_no} · {src.title}
                          </div>
                          <div className={s.srcMeta}>
                            {src.file_name}
                            {src.category ? ` · ${src.category}` : ""} · chunk {src.chunk_no} · score{" "}
                            {src.score}
                            {src.kind !== "company_document" ? ` · ${src.kind}` : ""}
                          </div>
                          {src.snippet && <p className={s.snippet}>{src.snippet}</p>}
                          <a className={s.fileLink} href={src.file_url} target="_blank" rel="noreferrer">
                            원문 다운로드
                          </a>
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
              placeholder="사내 문서에 대해 질문하세요"
              aria-label="혜진봇 질문"
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
        aria-label={open ? "혜진봇 닫기" : "혜진봇 열기"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "×" : "혜"}
      </button>
    </div>
  );
}
