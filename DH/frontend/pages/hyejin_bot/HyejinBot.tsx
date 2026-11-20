"use client";

import { useEffect, useRef, useState } from "react";
import { askShiftBot } from "./chatApi";
import SourceList from "./SourceList";
import type { ChatTurn } from "./sources";
import { snapshotUiContext, startUiContextCapture, stopUiContextCapture } from "./uiContext";
import s from "./HyejinBot.module.css";

/**
 * Shift 봇 — 전역 우하단 FAB (app/layout).
 * 멀티턴·화면 맥락·출처 접힘. 대화는 브라우저 메모리만 (DB 테이블 없음).
 */
export default function HyejinBot() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startUiContextCapture();
    return () => stopUiContextCapture();
  }, []);

  function startNewChat() {
    if (busy) return;
    setTurns([]);
    setError(null);
    setQ("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text || busy) return;
    setError(null);
    setQ("");

    const history = turns
      .filter((t) => t.role === "user" || t.role === "assistant")
      .map((t) => ({ role: t.role, content: t.content }))
      .slice(-6);

    setTurns((t) => [...t, { role: "user", content: text, sources: [] }]);
    setBusy(true);
    try {
      const res = await askShiftBot(text, {
        history,
        uiContext: snapshotUiContext(),
      });
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
              <p className={s.panelSub}>문서·관리도·품질 KPI · 대화는 이 창에만 유지</p>
            </div>
            <div className={s.headActions}>
              <button
                type="button"
                className={s.newChatBtn}
                disabled={busy || turns.length === 0}
                onClick={startNewChat}
              >
                새 채팅
              </button>
              <button
                type="button"
                className={s.closeBtn}
                aria-label="Shift 닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          {error && (
            <div className={s.errorBox} role="alert">
              {error}
            </div>
          )}

          <div className={s.thread} aria-live="polite">
            {turns.length === 0 && (
              <p className={s.empty}>질문을 입력하세요. 새 채팅으로 이전 대화를 끊을 수 있습니다.</p>
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
                  <SourceList sources={turn.sources} answer={turn.content} />
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
              placeholder="이어서 질문하거나 새 주제를 물어보세요"
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
