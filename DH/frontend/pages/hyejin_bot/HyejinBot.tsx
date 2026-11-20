"use client";

import { useEffect, useRef, useState } from "react";
import { askShiftBot } from "./chatApi";
import SourceList from "./SourceList";
import type { ChatTurn } from "./sources";
import { snapshotUiContext, startUiContextCapture, stopUiContextCapture } from "./uiContext";
import s from "./HyejinBot.module.css";

/** 탭 세션만 — DB 테이블 없음. 새 채팅 시 삭제 */
const TURNS_KEY = "shift_chat_turns";

function loadTurns(): ChatTurn[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(TURNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatTurn[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string",
    );
  } catch {
    return [];
  }
}

function saveTurns(turns: ChatTurn[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (turns.length === 0) sessionStorage.removeItem(TURNS_KEY);
    else sessionStorage.setItem(TURNS_KEY, JSON.stringify(turns));
  } catch {
    /* quota 등 — 무시 */
  }
}

/**
 * Shift 봇 — 전역 우하단 FAB (app/layout).
 * 패널 닫아도 대화 유지. 새 채팅 전까지 sessionStorage. DB 없음.
 */
export default function HyejinBot() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startUiContextCapture();
    setTurns(loadTurns());
    setHydrated(true);
    return () => stopUiContextCapture();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveTurns(turns);
  }, [turns, hydrated]);

  function startNewChat() {
    if (busy) return;
    setTurns([]);
    setError(null);
    setQ("");
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.removeItem(TURNS_KEY);
      } catch {
        /* ignore */
      }
    }
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
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    try {
      const res = await askShiftBot(text, {
        history,
        uiContext: snapshotUiContext(),
      });
      setTurns((t) => [...t, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  return (
    <div className={s.page}>
      <div
        className={open ? s.panel : `${s.panel} ${s.panelHidden}`}
        role="dialog"
        aria-label="Shift 채팅"
        aria-hidden={!open}
        hidden={!open}
      >
        <header className={s.panelHead}>
          <div>
            <div className={s.panelTitle}>Shift</div>
            <p className={s.panelSub}>문서·관리도·품질 · 새 채팅 전까지 대화 유지</p>
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

        <div className={s.thread} aria-live="polite" aria-busy={busy}>
          {turns.length === 0 && !busy && (
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
                <SourceList sources={turn.sources ?? []} answer={turn.content} />
              </div>
            ),
          )}
          {busy && (
            <div className={s.bubbleBot} aria-label="Shift 답변 생성 중">
              <div className={s.botLabel}>Shift</div>
              <div className={s.typingDots} aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>
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
