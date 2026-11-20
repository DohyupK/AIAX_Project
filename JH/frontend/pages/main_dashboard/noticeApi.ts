// 메인 대시보드 일일 공정 알람 공지 — JH API GET /api/main/daily-notice
import type { Notice, NoticeTag } from "./data";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const FETCH_TIMEOUT_MS = 60_000; // 캐시 miss 시 샷 집계·LLM 시간

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

/** 오늘(KST) 전날 알람 AI 공지. 실패·503이면 null (하드코딩 공지만 표시) */
export async function fetchDailyNotice(): Promise<Notice | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/main/daily-notice`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error("[main_dashboard] 일일 공지 조회 실패", res.status);
      return null;
    }
    const data: unknown = await res.json();
    if (!isNotice(data)) {
      console.error("[main_dashboard] 일일 공지 형식 오류", data);
      return null;
    }
    return data;
  } catch (e) {
    console.error("[main_dashboard] 일일 공지 조회 실패", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
