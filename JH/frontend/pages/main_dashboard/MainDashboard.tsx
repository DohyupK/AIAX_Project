"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./MainDashboard.module.css";
import { CURRENT_USER, EVENTS, NOTICES, type Notice, type NoticeTag } from "./data";

// 메모 저장소: 백엔드 전까지 브라우저 쿠키 (같은 PC·브라우저에서만 유지)
// ponytail: 쿠키 1개(약 4KB) 한도 — 메모가 많아지면 DB/API로 옮길 것
const MEMO_COOKIE = "jh_main_dashboard_memos";
const COOKIE_MAX_VALUE = 3800; // 브라우저 쿠키 4096바이트 한도에서 이름·속성 여유분 제외
const TITLE_MAX = 50;
const CONTENT_MAX = 200;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const TAG_CLASS: Record<NoticeTag, string> = { 필독: styles.tagRed, 안전: styles.tagOrange, 일반: styles.tagBlue };

type Memo = { id: string; title: string; content: string };
type Memos = Record<string, Memo[]>; // 'YYYY-MM-DD' → 그날 메모 목록

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 쿠키 값에 한글·특수문자를 안전하게 넣기 위해 UTF-8 → base64
const encode = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

const isMemo = (m: unknown): m is Memo =>
  typeof m === "object" && m !== null &&
  typeof (m as Memo).id === "string" && typeof (m as Memo).title === "string" && typeof (m as Memo).content === "string";

function loadMemos(): Memos {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${MEMO_COOKIE}=`));
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(decode(raw.slice(MEMO_COOKIE.length + 1)));
    if (typeof parsed !== "object" || parsed === null) return {};
    // 손상·조작된 항목은 버리고 형식이 맞는 메모만 사용
    const memos: Memos = {};
    for (const [date, list] of Object.entries(parsed)) {
      if (Array.isArray(list)) memos[date] = list.filter(isMemo);
    }
    return memos;
  } catch (e) {
    console.warn("[main_dashboard] 메모 불러오기 실패", e);
    return {};
  }
}

/** 쿠키에 저장. 용량 초과면 false (저장하지 않음) */
function writeMemos(memos: Memos): boolean {
  const value = encode(JSON.stringify(memos));
  if (value.length > COOKIE_MAX_VALUE) return false;
  document.cookie = `${MEMO_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  return true;
}

/** 로그인 후 전원 공통 메인 대시보드: 회사 공지 + 회사 일정 캘린더 + 날짜별 메모 */
export default function MainDashboard() {
  // 오늘 날짜는 브라우저 시간 기준 — 정적 빌드 시점 날짜와 어긋나지 않도록 마운트 후 설정
  const [today, setToday] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState("");
  const [memos, setMemos] = useState<Memos>({});
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [openNotice, setOpenNotice] = useState<Notice | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(toKey(now));
    setMemos(loadMemos());
  }, []);

  // 공지 팝업: 열리면 닫기 버튼에 포커스, Esc로 닫기
  useEffect(() => {
    if (!openNotice) return;
    closeRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpenNotice(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNotice]);

  function selectDate(key: string) {
    setSelected(key);
    setTitle("");
    setContent("");
    setMessage(null);
  }

  function persist(next: Memos, okText: string): boolean {
    try {
      if (!writeMemos(next)) {
        setMessage({ text: "저장 공간이 부족합니다. 오래된 메모를 삭제하세요.", error: true });
        return false;
      }
      setMemos(next);
      setMessage({ text: okText, error: false });
      return true;
    } catch (e) {
      console.error("[main_dashboard] 메모 저장 실패", e);
      setMessage({ text: "메모를 저장하지 못했습니다. 브라우저 쿠키 설정을 확인하세요.", error: true });
      return false;
    }
  }

  function saveMemo() {
    if (!title.trim()) {
      setMessage({ text: "제목을 입력하세요", error: true });
      return;
    }
    const memo: Memo = { id: Date.now().toString(36), title: title.trim(), content: content.trim() };
    const next = { ...memos, [selected]: [...(memos[selected] ?? []), memo] };
    if (persist(next, "저장되었습니다")) {
      setTitle("");
      setContent("");
    }
  }

  function deleteMemo(id: string) {
    const list = (memos[selected] ?? []).filter((m) => m.id !== id);
    const next = { ...memos };
    if (list.length) next[selected] = list;
    else delete next[selected];
    persist(next, "삭제되었습니다");
  }

  // Enter = 저장, Shift+Enter = 줄바꿈. 한글 조합 중 Enter는 무시 (마지막 글자 중복 저장 방지)
  function onEnter(e: KeyboardEvent) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    saveMemo();
  }

  if (!today || !month) return <div className={styles.page} />;

  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const lastDate = new Date(year, mon + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ];
  const todayKey = toKey(today);
  const selectedEvents = EVENTS.filter((e) => e.date === selected);
  const selectedMemos = memos[selected] ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.user}>
          <span className={styles.avatar} aria-hidden>
            {CURRENT_USER.name[0]}
          </span>
          {CURRENT_USER.name} · {CURRENT_USER.role}
        </div>
      </header>

      <section className={styles.card} aria-labelledby="notice-title">
        <div className={styles.cardHead}>
          <h2 id="notice-title" className={styles.cardTitle}>회사 전체 공지</h2>
          {/* 전체 공지 페이지 미구현 — 링크 자리 */}
          <a className={styles.more} href="#notices">전체 보기</a>
        </div>
        <ul className={styles.noticeList}>
          {NOTICES.map((n) => (
            <li key={n.id}>
              <button type="button" className={styles.notice} onClick={() => setOpenNotice(n)}>
                <span className={`${styles.tag} ${TAG_CLASS[n.tag]}`}>{n.tag}</span>
                <span className={styles.noticeTitle}>{n.title}</span>
                <span className={styles.noticeDate}>{n.date.slice(5).replace("-", ".")}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.body}>
        <section className={`${styles.card} ${styles.calendar}`} aria-labelledby="calendar-title">
          <div className={styles.cardHead}>
            <h2 id="calendar-title" className={styles.cardTitle}>회사 일정</h2>
            <div className={styles.monthNav}>
              <button type="button" className={styles.navBtn} aria-label="이전 달" onClick={() => setMonth(new Date(year, mon - 1, 1))}>
                ‹
              </button>
              <span>{year}년 {mon + 1}월</span>
              <button type="button" className={styles.navBtn} aria-label="다음 달" onClick={() => setMonth(new Date(year, mon + 1, 1))}>
                ›
              </button>
            </div>
          </div>
          <div className={styles.grid}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`${styles.weekday} ${i === 0 ? styles.sun : ""} ${i === 6 ? styles.sat : ""}`}>
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={`blank-${i}`} />;
              const key = `${year}-${pad(mon + 1)}-${pad(d)}`;
              const dow = i % 7;
              const isToday = key === todayKey;
              const cls = [
                styles.day,
                key === selected ? styles.selected : "",
                isToday ? styles.today : "",
              ].join(" ");
              return (
                <button
                  key={key}
                  type="button"
                  className={cls}
                  onClick={() => selectDate(key)}
                  aria-pressed={key === selected}
                  aria-current={isToday ? "date" : undefined}
                >
                  <span className={`${styles.dayNum} ${dow === 0 ? styles.sun : ""} ${dow === 6 ? styles.sat : ""}`}>
                    <span className={styles.dayText}>{d}</span>
                    {memos[key]?.length ? <span className={styles.memoDot} title="메모 있음" /> : null}
                  </span>
                  {EVENTS.filter((e) => e.date === key).map((e) => (
                    <span key={e.title} className={`${styles.event} ${styles[e.tone]}`}>
                      {e.title}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        </section>

        <aside className={`${styles.card} ${styles.memo}`} aria-labelledby="memo-title">
          <h2 id="memo-title" className={styles.cardTitle}>내 메모</h2>
          <p className={styles.sub}>{selected.replaceAll("-", ".")}</p>
          {selectedEvents.length > 0 && (
            <ul className={styles.memoEvents}>
              {selectedEvents.map((e) => (
                <li key={e.title}>{e.title}</li>
              ))}
            </ul>
          )}
          <input
            className={styles.input}
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => {
              setTitle(e.target.value);
              setMessage(null);
            }}
            onKeyDown={onEnter}
            placeholder="제목 (필수)"
            aria-label={`${selected} 메모 제목`}
            aria-required
          />
          <textarea
            className={styles.textarea}
            value={content}
            maxLength={CONTENT_MAX}
            onChange={(e) => {
              setContent(e.target.value);
              setMessage(null);
            }}
            onKeyDown={onEnter}
            placeholder="내용 (선택) — Enter 저장, Shift+Enter 줄바꿈"
            aria-label={`${selected} 메모 내용`}
          />
          <span className={styles.counter}>{content.length}/{CONTENT_MAX}</span>
          <button type="button" className={styles.saveBtn} onClick={saveMemo}>
            메모 저장
          </button>
          {message && (
            <p className={message.error ? styles.errorMsg : styles.savedMsg} role="status">
              {message.text}
            </p>
          )}

          {selectedMemos.length > 0 && (
            <div className={styles.savedList}>
              <p className={styles.savedHead}>저장된 메모</p>
              {selectedMemos.map((m) => (
                <details key={m.id} className={styles.savedItem}>
                  <summary className={styles.savedTitle}>{m.title}</summary>
                  {m.content && <p className={styles.savedContent}>{m.content}</p>}
                  <button type="button" className={styles.deleteBtn} onClick={() => deleteMemo(m.id)}>
                    삭제
                  </button>
                </details>
              ))}
            </div>
          )}
        </aside>
      </div>

      {openNotice && (
        <div className={styles.backdrop} onClick={() => setOpenNotice(null)}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogHead}>
              <span className={`${styles.tag} ${TAG_CLASS[openNotice.tag]}`}>{openNotice.tag}</span>
              <span className={styles.noticeDate}>{openNotice.date.replaceAll("-", ".")}</span>
              <button ref={closeRef} type="button" className={styles.closeBtn} aria-label="닫기" onClick={() => setOpenNotice(null)}>
                ×
              </button>
            </div>
            <h3 id="notice-dialog-title" className={styles.dialogTitle}>{openNotice.title}</h3>
            <p className={styles.dialogBody}>{openNotice.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}
