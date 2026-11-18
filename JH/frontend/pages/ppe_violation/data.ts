// 보호구 검사 기록·월간 원자료 조회 — 서버: JH/api/ppe/router.py (판정 ai.ppe_check + 출입·소속 lake 사본)
// 실행: cd JH/api && uv run uvicorn main:app --host 127.0.0.1 --port 8000
import type { MonthlyRaw } from "./monthly";
import type { Gate, Gear } from "./rules";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type ScanResult = "pass" | "violation" | "undecidable";

export interface ScanRecord {
  id: number;
  date: string;      // 'YYYY-MM-DD' 근무 시작 날짜
  time: string;      // 'HH:mm:ss' 카드 태깅 시각 (KST)
  userId: string;    // 사원 = 사번 e0001 / 하청 = 카드 vc0001 (이름 없음)
  gate: Gate;
  company: string;   // 사원 = 부서명 / 하청 = 업체명
  companyType: "하청업체" | "본사";
  detected: Gear[];  // 착용 확인된 장구
  unknown: Gear[];   // 카메라가 판정하지 못한 장구
  result: ScanResult;
  manualResult: "pass" | "violation" | null; // 판정 불가 건을 안전관리자가 확인한 결과
  manualBy: string | null;
}

interface ApiCheck extends Omit<ScanRecord, "companyType" | "detected" | "unknown"> {
  vendor: boolean;
  gears: Record<Gear, boolean | null>;
}

async function get<T>(path: string): Promise<T> {
  // 10초 넘게 응답이 없으면 끊어 「불러오는 중」 고착 방지
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${path} 요청 실패 (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

/** 검사 기록이 있는 날짜 (최근 날짜가 먼저) */
export const fetchScanDates = () => get<string[]>("/api/ppe/dates");

/** 기간(from~to, 양 끝 포함, 'YYYY-MM-DD') 검사 기록 (최신순). 최대 92일 — 서버가 400으로 거절 */
export async function fetchScanRecords(from: string, to: string): Promise<ScanRecord[]> {
  const q = new URLSearchParams({ from, to });
  const rows = await get<ApiCheck[]>(`/api/ppe/checks?${q}`);
  return rows.map(({ vendor, gears, ...r }) => {
    const keys = Object.keys(gears) as Gear[];
    return {
      ...r,
      companyType: vendor ? "하청업체" : "본사",
      detected: keys.filter((g) => gears[g] === true),
      unknown: keys.filter((g) => gears[g] === null),
    };
  });
}

/** 월간 보고서 원자료 (계산은 monthly.ts) */
export const fetchMonthlyRaw = () => get<MonthlyRaw[]>("/api/ppe/monthly");
