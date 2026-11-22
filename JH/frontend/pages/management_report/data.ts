// 경영 관리자 리포트 데이터 — 전부 서버 실제 값 (JH API /api/report/*, 목업 없음)
// 생산량·최종 불량(daily, mes 세 라인 합계) · 안전(safety, 보호구 대시보드 기준) · SPC 경고 알람(spc, mes × mes.spc_limit)
// · 근태(attendance, org.employee_record 근무 예정자 기준) · 고정값(fixed, org.fixed_value: 단가·재활용 회수액·재활용률·MTTR·MTBF·리콜)
import type { Gear } from "../ppe_violation/rules";

export type Period = "daily" | "weekly" | "monthly";

export const LINE = "전체 라인(line_no1~3)";
export const PRODUCT = "CylinderHead";

/** 고정값 1행 (서버 org.fixed_value) — 적용 시작일 이력 그대로 */
export interface FixedRow { name: string; value: number; unit: string; effectiveDate: string }
/** 리포트 1건에 적용한 고정값 (DB 에 없으면 null → 화면 「—」) */
export interface FixedValues {
  unitPrice: number | null;    // 제품_단가 (원/개) — 생산 금액·불량 손실
  recycleValue: number | null; // 재활용_회수액 (원/개)
  recycleRate: number | null;  // 재활용률 (0~1) — 재활용 수량 = 최종 불량 × 재활용률
  mttr: number | null;         // MTTR (시간)
  mtbf: number | null;         // MTBF (시간)
  recall: number | null;       // 리콜_횟수_12개월 (회)
}
/** 리포트 1건 (기간 합산) — buildReport */
export interface PeriodReport {
  fixed: FixedValues;      // 리포트 기간 마지막 날 기준 고정값
  noData: boolean;         // 기간에 생산 데이터가 없음 → 생산량·불량 「—」
  attendance: { total: number; present: number }; // 근무 예정자 · 출근 (주간·월간 = 기간 누적 연인원)
  production: number;      // 생산량(개)
  defects: number;         // 최종 불량(개)
  spcAlarms: { ucl: number; lcl: number }; // I 관리선 밖 「샷 × 변수」 수
  safety: {
    scans: number;           // 검색대 태깅 수
    violations: number;      // 필수 장구 미착용 건수
    repeatViolators: number; // 기간 내 2회 이상 위반 인원
    byCompany: { company: string; type: "본사" | "하청업체"; count: number }[];
    byGear: Record<Gear, number>;
  };
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/** /api/report/* 조회 — 10초 넘게 응답이 없으면 끊어 「불러오는 중」 고착 방지 */
async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = `${BASE}/api/report/${path}${params ? `?${new URLSearchParams(params)}` : ""}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`/api/report/${path} 요청 실패 (HTTP ${res.status})`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`/api/report/${path} 요청 시간 초과 (10초) — 서버 DB(.env DATABASE_URL) 확인`);
    }
    throw e;
  }
}

/** 날짜별 생산량·최종 불량 (서버 mes, 세 라인 합계). 생산 없는 날은 빠짐 */
export interface DailyProduction { date: string; production: number; defects: number }
/** 안전 원자료 (서버 ai.ppe_check, 보호구 착용 위반 대시보드와 같은 판정·위반 기준) */
export interface SafetyData {
  scans: { date: string; count: number }[]; // 날짜별 판정 수 (판정 불가 포함)
  violations: { date: string; userId: string; company: string; vendor: boolean; missing: Gear[] }[];
}
/** 날짜별 SPC 경고 알람 — I 관리선 밖 「샷 × 변수」 수 */
export interface SpcDaily { date: string; ucl: number; lcl: number }
/** 날짜별 근태 — scheduled = 근무 예정자, present = 그중 출근 */
export interface AttendanceDaily { date: string; scheduled: number; present: number }

/** 리포트 원자료 묶음 (목록 전체 기간을 한 번에) */
export interface ReportSource {
  daily: DailyProduction[]; safety: SafetyData; spc: SpcDaily[]; attendance: AttendanceDaily[]; fixed: FixedRow[];
}

/** 리포트 목록 시작일 = 생산 데이터 첫날 'YYYY-MM-DD' (데이터 없으면 null) */
export async function fetchFirstDate(): Promise<string | null> {
  return (await get<{ first: string | null }>("first-date")).first;
}

/** 기간(from~to, 'YYYY-MM-DD', 양 끝 포함, 최대 220일) 리포트 원자료 전부 */
export async function fetchReportSource(from: string, to: string): Promise<ReportSource> {
  const range = { from, to };
  const [daily, safety, spc, attendance, fixed] = await Promise.all([
    get<DailyProduction[]>("daily", range), get<SafetyData>("safety", range), get<SpcDaily[]>("spc", range),
    get<AttendanceDaily[]>("attendance", range), get<FixedRow[]>("fixed"),
  ]);
  return { daily, safety, spc, attendance, fixed };
}
