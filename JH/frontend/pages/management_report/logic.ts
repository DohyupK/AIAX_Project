// 경영 리포트 계산 (화면·CSS import 없음) — 자체 점검: logic.check.ts
// 타입만 import → node 단독 실행 가능
import type { FixedRow, FixedValues, Period, PeriodReport, ReportSource, SafetyData } from "./data";

/** 분모 0이면 null */
export const ratio = (n: number, d: number) => (d ? n / d : null);

/** 로컬 날짜 YYYY-MM-DD (sv-SE 로캘이 ISO 형식) */
const ymd = (d: Date) => d.toLocaleDateString("sv-SE");

export interface ReportItem { id: string; period: Period; from: string; to: string; title: string }

/** 목록 한 페이지 건수 (아래 페이지 번호로 다음 15건) */
export const PAGE_SIZE = 15;
const PERIOD_LABEL: Record<Period, string> = { daily: "일일", weekly: "주간", monthly: "월간" };

/**
 * 기간별 리포트 목록 (최신순) — offset 번째(0 = 이번 기간)부터 count 건
 * 일일: 하루씩 / 주간: 달력 주 월~일 (이번 주는 월~오늘) / 월간: 달력 월 (이번 달은 오늘까지)
 */
export function listReports(p: Period, now: Date, count: number, offset = 0): ReportItem[] {
  return Array.from({ length: count }, (_, k) => {
    const i = k + offset;
    let from: Date, to: Date;
    if (p === "monthly") {
      from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      to = i === 0 ? new Date(now) : new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // 0일 = 전달 말일
    } else if (p === "weekly") {
      // 달력 주 월~일. getDay(): 일=0 → 이번 주 월요일까지 (요일+6)%7 일 전
      const monday = now.getDate() - ((now.getDay() + 6) % 7) - i * 7;
      from = new Date(now.getFullYear(), now.getMonth(), monday);
      to = i === 0 ? new Date(now) : new Date(now.getFullYear(), now.getMonth(), monday + 6);
    } else {
      from = to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    }
    const f = ymd(from), t = ymd(to);
    const name = p === "monthly" ? `${from.getFullYear()}년 ${from.getMonth() + 1}월` : f === t ? f : `${f} ~ ${t}`;
    return { id: `${p}-${f}`, period: p, from: f, to: t, title: `${name} ${PERIOD_LABEL[p]} 경영 리포트` };
  });
}

/** 이번 기간부터 first('YYYY-MM-DD', 데이터 첫날)가 든 기간까지 리포트 수 (최소 1) */
export function reportCount(p: Period, now: Date, first: string): number {
  const [y, m, d] = first.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000); // 서머타임 없는 KST 기준 반올림
  const monday = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate() - ((x.getDay() + 6) % 7));
  const n = p === "daily" ? days(today, f) + 1
    : p === "weekly" ? days(monday(today), monday(f)) / 7 + 1
    : (today.getFullYear() - f.getFullYear()) * 12 + today.getMonth() - f.getMonth() + 1;
  return Math.max(1, n);
}

/**
 * 안전 원자료(기간 합산) — 재위반 = 그 기간 안 2회 이상 위반한 사람
 * 업체: 본사 사원 = 부서 이름, 하청 = 업체 이름. 장구별 = 위반 건의 미착용 판정 수
 */
function safetyOf(data: SafetyData, inRange: (d: string) => boolean): PeriodReport["safety"] {
  const v = data.violations.filter((x) => inRange(x.date));
  const perUser = new Map<string, number>();
  const perCompany = new Map<string, { company: string; type: "본사" | "하청업체"; count: number }>();
  const byGear = { helmet: 0, shoes: 0, vest: 0, gloves: 0, goggles: 0 };
  for (const x of v) {
    perUser.set(x.userId, (perUser.get(x.userId) ?? 0) + 1);
    const key = `${x.vendor}|${x.company}`;
    const c = perCompany.get(key) ?? { company: x.company, type: x.vendor ? "하청업체" : "본사", count: 0 };
    c.count++;
    perCompany.set(key, c);
    for (const g of x.missing) byGear[g]++;
  }
  return {
    scans: data.scans.filter((x) => inRange(x.date)).reduce((a, x) => a + x.count, 0),
    violations: v.length,
    repeatViolators: [...perUser.values()].filter((n) => n >= 2).length,
    byCompany: [...perCompany.values()],
    byGear,
  };
}

/** 리포트 1건 = 기간(from~to) 원자료 합산 + 기간 마지막 날 기준 고정값 */
export function buildReport(src: ReportSource, from: string, to: string): PeriodReport {
  const inRange = (d: string) => d >= from && d <= to;
  function sum<T extends { date: string }>(rows: T[], val: (r: T) => number) {
    return rows.reduce((a, r) => a + (inRange(r.date) ? val(r) : 0), 0);
  }
  return {
    fixed: pickFixed(src.fixed, to),
    noData: !src.daily.some((d) => inRange(d.date)),
    production: sum(src.daily, (d) => d.production),
    defects: sum(src.daily, (d) => d.defects),
    spcAlarms: { ucl: sum(src.spc, (d) => d.ucl), lcl: sum(src.spc, (d) => d.lcl) },
    attendance: { total: sum(src.attendance, (d) => d.scheduled), present: sum(src.attendance, (d) => d.present) },
    safety: safetyOf(src.safety, inRange),
  };
}

/** 화면 항목 ↔ DB org.fixed_value.value_name */
const FIXED_NAME: Record<keyof FixedValues, string> = {
  unitPrice: "제품_단가", recycleValue: "재활용_회수액", recycleRate: "재활용률",
  mttr: "MTTR", mtbf: "MTBF", recall: "리콜_횟수_12개월",
};

/** 날짜(YYYY-MM-DD)에 적용되는 고정값 — 이름마다 적용 시작일 ≤ 그날 중 가장 최근 행, 없으면 null */
export function pickFixed(rows: FixedRow[], date: string): FixedValues {
  const at = (name: string) => {
    let best: FixedRow | null = null;
    for (const r of rows) if (r.name === name && r.effectiveDate <= date && (!best || r.effectiveDate >= best.effectiveDate)) best = r;
    return best ? best.value : null;
  };
  return Object.fromEntries(Object.entries(FIXED_NAME).map(([k, name]) => [k, at(name)])) as unknown as FixedValues;
}

/**
 * 리포트 파생 지표 (비율 0~1, 금액 원). 고정값이 없으면(null) 그 값으로 계산하는 항목은 null → 화면 「—」
 * 재활용 = 최종 불량 × 재활용률 (불량 주물은 재용해, 회수 = 재활용 수량 × 회수액). 순손실 = 불량 손실 − 재활용 회수
 */
export function computeReport(r: PeriodReport) {
  const { unitPrice, recycleValue, recycleRate } = r.fixed;
  const mul = (n: number | null, v: number | null) => (n == null || v == null ? null : n * v);
  const recycled = recycleRate == null ? null : Math.round(r.defects * recycleRate);
  const amount = mul(r.production, unitPrice), lossCost = mul(r.defects, unitPrice), recycleSaving = mul(recycled, recycleValue);
  const netLoss = lossCost == null || recycleSaving == null ? null : lossCost - recycleSaving;
  return {
    attendanceRate: ratio(r.attendance.present, r.attendance.total),
    amount,
    defectRate: ratio(r.defects, r.production),
    lossCost,
    spcTotal: r.spcAlarms.ucl + r.spcAlarms.lcl,
    recycled,
    recycleSaving,
    netLoss,
    netLossRate: netLoss == null || amount == null ? null : ratio(netLoss, amount),
    perCapita: ratio(r.production, r.attendance.present),     // 인당 생산(개)
    safetyPassRate: ratio(r.safety.scans - r.safety.violations, r.safety.scans),
    companies: [...r.safety.byCompany].sort((a, b) => b.count - a.count),
    gears: (Object.entries(r.safety.byGear) as [keyof PeriodReport["safety"]["byGear"], number][])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]),
  };
}

/** 전기(전일·전주·전월) 대비 증감 — 직전 리포트 없으면 null. 불량률은 %p */
export function compareReport(r: PeriodReport, prev: PeriodReport | null) {
  if (!prev) return { violations: null, defectRatePp: null };
  const cur = ratio(r.defects, r.production), before = ratio(prev.defects, prev.production);
  return {
    violations: r.safety.violations - prev.safety.violations,
    defectRatePp: cur == null || before == null ? null : (cur - before) * 100,
  };
}
