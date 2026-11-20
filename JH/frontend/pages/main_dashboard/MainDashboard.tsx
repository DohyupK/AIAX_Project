"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CURRENT_USER, EVENTS, NOTICES, type EventTone, type Notice, type NoticeTag } from "./data";
import { fetchDailyNotice } from "./noticeApi";
import {
  BADGE, BTN_PRIMARY, CARD, CARD_HEAD, CARD_TITLE, CLOSE_BTN, FIELD, FOCUS, H1, MODAL_BACKDROP, MODAL_PANEL, PAGE, TONE,
} from "../../common/ui";

// 메모 저장소: 백엔드 전까지 브라우저 쿠키 (같은 PC·브라우저에서만 유지)
// ponytail: 쿠키 1개(약 4KB) 한도 — 메모가 많아지면 DB/API로 옮길 것
const MEMO_COOKIE = "jh_main_dashboard_memos";
const COOKIE_MAX_VALUE = 3800; // 브라우저 쿠키 4096바이트 한도에서 이름·속성 여유분 제외
const TITLE_MAX = 50;
const CONTENT_MAX = 200;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const TAG_CLASS: Record<NoticeTag, string> = { 필독: TONE.bad, 안전: TONE.warn, 일반: TONE.info };
const EVENT_CLASS: Record<EventTone, string> = { red: TONE.bad, orange: TONE.warn, blue: TONE.info, green: TONE.ok };
// 폰(460px 이하) 달력 칸은 일정 글자 대신 색 점
const EVENT_DOT: Record<EventTone, string> = {
  red: "bg-red-500",
  orange: "bg-yellow-500",
  blue: "bg-sky-500",
  green: "bg-green-500",
};

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
  const [notices, setNotices] = useState<Notice[]>(NOTICES);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(toKey(now));
    setMemos(loadMemos());
  }, []);

  // 전날 관리도 알람 AI 공지 — 성공 시 목록 맨 앞 (실패해도 하드코딩 공지만 유지)
  useEffect(() => {
    let cancelled = false;
    fetchDailyNotice().then((daily) => {
      if (cancelled || !daily) return;
      setNotices((prev) => (prev.some((n) => n.id === daily.id) ? prev : [daily, ...prev]));
    });
    return () => {
      cancelled = true;
    };
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

  if (!today || !month) return <div className={PAGE} />;

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
  const navBtn = `flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-gray-600 phone:size-10 ${FOCUS}`;

  return (
    <div className={PAGE}>
      {/* 제목 줄 — 오른쪽 사용자 (로그인 연동 전 표시용) */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 phone:mb-5">
        <h1 className={H1}>메인 대시보드</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span
            className="grid size-8 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700 dark:bg-brand-400/20 dark:text-brand-400"
            aria-hidden
          >
            {CURRENT_USER.name[0]}
          </span>
          <span className="font-medium text-gray-800 dark:text-gray-100">{CURRENT_USER.name}</span>
          <span className="phone:hidden">· {CURRENT_USER.role}</span>
        </div>
      </div>

      {/* PC: 공지(전체) / 달력 8칸 + 메모 4칸. 860px 이하: 1열 — 공지 → 달력 → 메모 */}
      <div className="grid grid-cols-12 gap-6 phone:gap-4">
        <section className={`${CARD} col-span-12`} aria-labelledby="notice-title">
          <header className={CARD_HEAD}>
            <h2 id="notice-title" className={CARD_TITLE}>회사 전체 공지</h2>
            {/* 전체 공지 페이지 미구현 — 링크 자리 */}
            <a className={`text-sm font-medium text-brand-700 hover:text-brand-900 dark:text-brand-400 ${FOCUS}`} href="#notices">
              전체 보기
            </a>
          </header>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {notices.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setOpenNotice(n)}
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30 phone:px-4 phone:py-3.5 ${FOCUS} focus-visible:-outline-offset-2`}
                >
                  <span className={`${BADGE} ${TAG_CLASS[n.tag]}`}>{n.tag}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-100">{n.title}</span>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{n.date.slice(5).replace("-", ".")}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${CARD} col-span-12 flex flex-col min-[861px]:col-span-8`} aria-labelledby="calendar-title">
          <header className={CARD_HEAD}>
            <h2 id="calendar-title" className={CARD_TITLE}>회사 일정</h2>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <button type="button" className={navBtn} aria-label="이전 달" onClick={() => setMonth(new Date(year, mon - 1, 1))}>
                ‹
              </button>
              <span className="min-w-[6.5rem] text-center">{year}년 {mon + 1}월</span>
              <button type="button" className={navBtn} aria-label="다음 달" onClick={() => setMonth(new Date(year, mon + 1, 1))}>
                ›
              </button>
            </div>
          </header>
          {/* 주(5~6줄)가 카드 높이를 똑같이 나눔 */}
          <div className="grid flex-1 auto-rows-[minmax(88px,1fr)] grid-cols-7 grid-rows-[auto] gap-1.5 p-4 tablet:auto-rows-[minmax(64px,auto)] phone:auto-rows-[minmax(44px,auto)] phone:gap-1 phone:p-2">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`pb-1 text-center text-xs font-semibold ${
                  i === 0 ? "text-red-500" : i === 6 ? "text-sky-600 dark:text-sky-500" : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={`blank-${i}`} />;
              const key = `${year}-${pad(mon + 1)}-${pad(d)}`;
              const dow = i % 7;
              const isToday = key === todayKey;
              const isSel = key === selected;
              const hasMemo = (memos[key]?.length ?? 0) > 0;
              const dayEvents = EVENTS.filter((e) => e.date === key);
              const numColor = isToday
                ? "bg-brand-700 font-bold text-white dark:bg-brand-500"
                : dow === 0
                  ? "text-red-500"
                  : dow === 6
                    ? "text-sky-600 dark:text-sky-500"
                    : "text-gray-700 dark:text-gray-200";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDate(key)}
                  aria-pressed={isSel}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${mon + 1}월 ${d}일${dayEvents.length ? ` 일정 ${dayEvents.map((e) => e.title).join(", ")}` : ""}${hasMemo ? " 메모 있음" : ""}`}
                  className={`flex min-w-0 flex-col gap-1 rounded-lg border p-1.5 text-left text-xs transition phone:items-center phone:p-1 ${FOCUS} ${
                    isSel
                      ? "border-brand-700 ring-1 ring-brand-700 dark:border-brand-400 dark:ring-brand-400"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700/60 dark:hover:border-gray-600"
                  }`}
                >
                  <span className="flex w-full items-center justify-between phone:justify-center">
                    <span className={`inline-flex size-5 items-center justify-center rounded-full ${numColor}`}>{d}</span>
                    {hasMemo && <span className="size-1.5 rounded-full bg-brand-500 phone:hidden dark:bg-brand-400" title="메모 있음" />}
                  </span>
                  {/* PC·태블릿: 일정 이름 */}
                  {dayEvents.map((e) => (
                    <span key={e.title} className={`truncate rounded px-1.5 py-px text-[11px] font-medium phone:hidden ${EVENT_CLASS[e.tone]}`}>
                      {e.title}
                    </span>
                  ))}
                  {/* 폰: 일정·메모 색 점 */}
                  {(dayEvents.length > 0 || hasMemo) && (
                    <span className="hidden gap-0.5 phone:flex" aria-hidden>
                      {dayEvents.map((e) => (
                        <span key={e.title} className={`size-1.5 rounded-full ${EVENT_DOT[e.tone]}`} />
                      ))}
                      {hasMemo && <span className="size-1.5 rounded-full bg-brand-500 dark:bg-brand-400" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside className={`${CARD} col-span-12 flex flex-col min-[861px]:col-span-4`} aria-labelledby="memo-title">
          <header className={CARD_HEAD}>
            <h2 id="memo-title" className={CARD_TITLE}>내 메모</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{selected.replaceAll("-", ".")}</span>
          </header>
          <div className="flex flex-col gap-3 p-5 phone:p-4">
            {/* 선택한 날 일정 — 폰에서는 달력에 이름이 안 보이므로 여기서 확인 */}
            {selectedEvents.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="이날 일정">
                {selectedEvents.map((e) => (
                  <li key={e.title} className={`${BADGE} ${EVENT_CLASS[e.tone]}`}>
                    {e.title}
                  </li>
                ))}
              </ul>
            )}
            <input
              className={`form-input ${FIELD}`}
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
            <div>
              <textarea
                className={`form-textarea min-h-28 resize-y ${FIELD}`}
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
              <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {content.length}/{CONTENT_MAX}
              </p>
            </div>
            <button
              type="button"
              onClick={saveMemo}
              className={BTN_PRIMARY}
            >
              메모 저장
            </button>
            {message && (
              <p
                className={`text-center text-sm ${message.error ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}
                role="status"
              >
                {message.text}
              </p>
            )}

            {selectedMemos.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">저장된 메모</p>
                {selectedMemos.map((m) => (
                  <details key={m.id} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700/60">
                    <summary className="cursor-pointer text-sm font-semibold break-all text-gray-800 dark:text-gray-100 phone:py-1">
                      {m.title}
                    </summary>
                    {m.content && <p className="mt-2 text-sm break-all whitespace-pre-wrap text-gray-600 dark:text-gray-300">{m.content}</p>}
                    <button
                      type="button"
                      onClick={() => deleteMemo(m.id)}
                      className={`mt-1 py-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 phone:py-2 ${FOCUS}`}
                    >
                      삭제
                    </button>
                  </details>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 공지 상세 팝업 — 폰은 아래에서 올라오는 시트 */}
      {openNotice && (
        <div className={MODAL_BACKDROP} onClick={() => setOpenNotice(null)}>
          <div
            className={MODAL_PANEL}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className={`${BADGE} ${TAG_CLASS[openNotice.tag]}`}>{openNotice.tag}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{openNotice.date.replaceAll("-", ".")}</span>
              <button
                ref={closeRef}
                type="button"
                aria-label="닫기"
                onClick={() => setOpenNotice(null)}
                className={CLOSE_BTN}
              >
                ×
              </button>
            </div>
            <h3 id="notice-dialog-title" className="mt-3 mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
              {openNotice.title}
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-gray-600 dark:text-gray-300">{openNotice.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}
