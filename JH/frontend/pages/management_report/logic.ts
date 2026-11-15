// 경영 리포트 계산 (화면·CSS import 없음) — 자체 점검: logic.check.ts
// 타입만 import → node 단독 실행 가능. 단가는 인자로 받음
import type { Period, PeriodReport } from "./data";

/** 분모 0이면 null */
export const ratio = (n: number, d: number) => (d ? n / d : null);

/** 로컬 날짜 YYYY-MM-DD (sv-SE 로캘이 ISO 형식) */
const ymd = (d: Date) => d.toLocaleDateString("sv-SE");

export interface ReportItem { id: string; period: Period; from: string; to: string; title: string }

export const LIST_COUNT: Record<Period, number> = { daily: 14, weekly: 8, monthly: 6 };
const PERIOD_LABEL: Record<Period, string> = { daily: "일일", weekly: "주간", monthly: "월간" };

/**
 * 기간별 리포트 목록 (최신순)
 * 일일: 하루씩 / 주간: 달력 주 월~일 (이번 주는 월~오늘) / 월간: 달력 월 (이번 달은 오늘까지)
 */
export function listReports(p: Period, now: Date, count = LIST_COUNT[p]): ReportItem[] {
  return Array.from({ length: count }, (_, i) => {
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

/** 문자열 → 0~1 고정 난수 (FNV-1a). 같은 리포트는 항상 같은 값 */
function rand01(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 0xffffffff;
}

/**
 * 기간 기준값에 리포트별 변동을 준 목업 리포트 (±spread 범위, 정합성 유지)
 * ponytail: 목업 전용. 집계 API 연동 시 리포트 id 로 실제 값을 받아 이 함수 삭제
 */
export function mockReport(base: PeriodReport, seed: string): PeriodReport {
  const v = (n: number, key: string, spread = 0.12) => Math.round(n * (1 - spread + 2 * spread * rand01(seed + key)));
  const production = v(base.production, "p");
  const defects = Math.min(production, v(base.defects, "d", 0.3));
  const firstDefects = Math.min(production, Math.max(defects, v(base.firstDefects, "f", 0.2)));
  const total = base.attendance.total;
  const present = Math.min(total, v(base.attendance.present, "a", 0.03));
  const byCompany = base.safety.byCompany
    .map((c) => ({ ...c, count: v(c.count, "c" + c.company, 0.5) }))
    .filter((c) => c.count > 0);
  const violations = byCompany.reduce((a, c) => a + c.count, 0);
  const byGear = { ...base.safety.byGear };
  for (const g of Object.keys(byGear) as (keyof typeof byGear)[]) byGear[g] = v(byGear[g], "g" + g, 0.5);
  // 위반 1건에 장구 1개 이상 → 장구 합계가 위반보다 작으면 최다 장구에 보정
  const gearSum = Object.values(byGear).reduce((a, n) => a + n, 0);
  if (gearSum < violations) {
    const top = (Object.keys(byGear) as (keyof typeof byGear)[]).sort((a, b) => byGear[b] - byGear[a])[0];
    byGear[top] += violations - gearSum;
  }
  return {
    attendance: { total, present },
    production,
    defects,
    defectTypes: scaleTo(base.defectTypes, defects),
    firstDefects,
    recycled: Math.min(firstDefects, v(base.recycled, "r", 0.2)),
    spcAlarms: { ucl: v(base.spcAlarms.ucl, "u", 0.4), lcl: v(base.spcAlarms.lcl, "l", 0.4) },
    safety: {
      scans: present,
      violations,
      repeatViolators: Math.min(violations, v(base.safety.repeatViolators, "rv", 0.5)),
      byCompany,
      byGear,
    },
  };
}

/** 리포트 파생 지표 (비율 0~1, 금액 원) */
export function computeReport(r: PeriodReport, unitPrice: number, recycleValue: number) {
  return {
    attendanceRate: ratio(r.attendance.present, r.attendance.total),
    amount: r.production * unitPrice,
    defectRate: ratio(r.defects, r.production),
    lossCost: r.defects * unitPrice,
    spcTotal: r.spcAlarms.ucl + r.spcAlarms.lcl,
    recycleRate: ratio(r.recycled, r.firstDefects),
    recycleSaving: r.recycled * recycleValue,
    netLoss: r.defects * unitPrice - r.recycled * recycleValue, // 불량 손실 − 재활용 회수
    netLossRate: ratio(r.defects * unitPrice - r.recycled * recycleValue, r.production * unitPrice),
    perCapita: ratio(r.production, r.attendance.present),     // 인당 생산(개)
    defectTypes: (Object.entries(r.defectTypes) as [keyof PeriodReport["defectTypes"], number][])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]),
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

/** 합계를 total 에 맞춰 비례 배분 (최대 잔여 방식 — 반올림 오차 없이 합계 일치) */
export function scaleTo<K extends string>(parts: Record<K, number>, total: number): Record<K, number> {
  const keys = Object.keys(parts) as K[];
  const sum = keys.reduce((a, k) => a + parts[k], 0);
  if (!sum) return { ...parts };
  const raw = keys.map((k) => (parts[k] / sum) * total);
  const out = Object.fromEntries(keys.map((k, i) => [k, Math.floor(raw[i])])) as Record<K, number>;
  let left = total - keys.reduce((a, k) => a + out[k], 0);
  for (const i of raw.map((x, i) => i).sort((a, b) => (raw[b] % 1) - (raw[a] % 1))) {
    if (left-- <= 0) break;
    out[keys[i]]++;
  }
  return out;
}
