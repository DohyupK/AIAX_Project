"use client";

import { useRef, useState } from "react";
import { askHyejinBot } from "./chatApi";
import type { ChatTurn } from "./sources";
import s from "./HyejinBot.module.css";

/**
 * 혜진봇 Phase A — JH /api/documents/search 로 사내 문서 근거 답 + 출처
 * ponytail Phase B: LLM 생성. casting 소스는 sources.ts stub
 */
export default function HyejinBot() {
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
      <header>
        <div className={s.crumb}>혜진봇</div>
        <h2 className={s.title}>혜진봇</h2>
      </header>

      <div className={s.banner}>
        사내 문서함(의미검색)을 바탕으로 답합니다. 답변과 함께 출처·원문 다운로드가 표시됩니다.
        casting 분석 자료·LLM 생성 답변은 이후 단계에서 연결합니다.
      </div>

      {error && (
        <div className={s.errorBox} role="alert">
          {error}
        </div>
      )}

      <div className={s.thread} aria-live="polite">
        {turns.length === 0 && (
          <p className={s.empty}>질문을 입력하면 사내 문서에서 근거를 찾아 보여 줍니다.</p>
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
          {busy ? "검색 중…" : "보내기"}
        </button>
      </form>
    </div>
  );
}
