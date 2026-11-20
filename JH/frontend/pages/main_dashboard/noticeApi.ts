// 메인 대시보드 일일 공정 알람 공지 — JH API GET /api/main/daily-notice
// 캐시: 브라우저 localStorage에 그날(KST) 공지 1건. 같은 날 다시 열면 API·LLM 호출 없음 (DB 테이블 사용 안 함)
import type { Notice, NoticeTag } from "./data";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const FETCH_TIMEOUT_MS = 60_000; // 샷 집계·LLM 요약 시간
const CACHE_KEY = "jh_daily_notice";

const TAGS: NoticeTag[] = ["필독", "안전", "일반"];

function isNotice(v: unknown): v is Notice {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.id === "number" &&
    typeof n.tag === "string" &&
    TAGS.includes(n.tag as NoticeTag) &&
    typeof n.title === "string" &&
    typeof n.date === "string" &&
    typeof n.content === "string"
  );
}

/** 오늘 날짜(KST) 'YYYY-MM-DD' — 서버 notice.date 와 같은 기준 */
const kstToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

function readCache(today: string): Notice | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    return isNotice(v) && v.date === today ? v : null;
  } catch (e) {
    console.warn("[main_dashboard] 일일 공지 캐시 읽기 실패", e);
    return null;
  }
}

function writeCache(notice: Notice) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(notice));
  } catch (e) {
    // 저장 불가(사생활 모드 등) — 다음 방문 때 다시 조회할 뿐
    console.warn("[main_dashboard] 일일 공지 캐시 저장 실패", e);
  }
}

// 진행 중 요청 공유 — StrictMode 이중 effect·빠른 재진입 때 LLM 요약을 두 번 돌리지 않게
let inflight: Promise<Notice | null> | null = null;

/** 오늘(KST) 전날 알람 AI 공지. 캐시 우선, 실패면 null (하드코딩 공지만 표시) */
export function fetchDailyNotice(): Promise<Notice | null> {
  return (inflight ??= loadDailyNotice().finally(() => {
    inflight = null;
  }));
}

async function loadDailyNotice(): Promise<Notice | null> {
  const today = kstToday();
  const cached = readCache(today);
  if (cached) return cached;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/main/daily-notice`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (res.status === 503) {
      // 서버가 「지금은 만들 수 없음」으로 응답 (데이터·LLM 장애) — 화면은 정상 동작하므로 warn
      const body = await res.json().catch(() => null);
      console.warn("[main_dashboard] 일일 공지 생성 불가 503", body?.detail ?? "");
      return null;
    }
    if (!res.ok) {
      console.error("[main_dashboard] 일일 공지 조회 실패", res.status);
      return null;
    }
    const data: unknown = await res.json();
    if (!isNotice(data)) {
      console.error("[main_dashboard] 일일 공지 형식 오류", data);
      return null;
    }
    writeCache(data);
    return data;
  } catch (e) {
    console.error("[main_dashboard] 일일 공지 조회 실패", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
