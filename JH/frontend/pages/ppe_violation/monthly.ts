// 월간 보호구 착용 위반 보고서 — 원자료(API) + 계산 (화면·CSS import 없음) — 자체 점검: rules.check.ts
// 타입만 import → node 단독 실행 가능. 원자료는 data.ts fetchMonthlyRaw (JH/api/ppe/router.py /monthly)
import type { Gate, Gear } from "./rules";

export const SITE = "회사 정문 보호구 게이트 a·b · 대상: 주조팀(casting1~3)·하청 작업자";

export type UnitType = "본청" | "협력업체";

/** 한 달 원자료 — DB에서 센 값만 두고, 비율·합계·순위는 아래 함수가 계산 */
export interface MonthlyRaw {
  month: string;      // 'YYYY-MM'
  from: string;       // 그 달 첫 검사일 'YYYY-MM-DD'
  to: string;         // 그 달 마지막 검사일
  days: number;       // 가동일 = 검사 기록이 있는 날 수
  registered: number; // 카메라 대상 등록 인원 (주조팀 재직 사원 + 그 달 사용 하청 카드)
  entered: number;    // 실제 판정받은 인원
  units: { name: string; type: UnitType; gate: Gate; scans: number; violations: number }[];
  gears: Record<Gear, { hq: number; sub: number }>; // 보호구별 필수 미착용 개수 (본청 / 협력업체)
  slots: { hour: number; violations: number }[];    // 태깅 시각(시)별 위반 건수, 많은 순
}

/** 위반율(1,000회당), 소수 1자리. 판정 0이면 null */
export function violationRate(violations: number, scans: number): number | null {
  return scans ? Math.round((violations / scans) * 10000) / 10 : null;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** 'YYYY-MM-DD' → '10. 5.' */
const md = (d: string) => `${Number(d.slice(5, 7))}. ${Number(d.slice(8, 10))}.`;

export function totals(raw: MonthlyRaw) {
  const scans = sum(raw.units.map((u) => u.scans));
  const violations = sum(raw.units.map((u) => u.violations));
  return { scans, violations, rate: violationRate(violations, scans) };
}

/** 보고서 한 장에 들어갈 값 전부 */
export function buildReport(month: string, all: MonthlyRaw[]) {
  const raw = all.find((r) => r.month === month);
  if (!raw) throw new Error(`보고서 원자료 없음: ${month}`);
  const [y, m] = month.split("-").map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const prev = all.find((r) => r.month === prevMonth);

  const cur = totals(raw);
  const prevTotal = prev ? totals(prev) : null;
  const delta = cur.rate !== null && prevTotal?.rate != null ? Math.round((cur.rate - prevTotal.rate) * 10) / 10 : null;

  // 가동 시작 = 원자료 중 첫 검사일. 가동 이후 이 달까지 중 최저/최고 (첫 달이면 비교 없음)
  const start = all.reduce((first, r) => (r.from < first ? r.from : first), raw.from);
  const [Y0, M0, D0] = start.split("-").map(Number);
  const history = all.filter((r) => r.month <= month).map((r) => totals(r).rate ?? 0);
  const rank =
    history.length < 2 ? "가동 첫 달"
    : cur.rate === Math.min(...history) ? `${M0}월 가동 이후 최저`
    : cur.rate === Math.max(...history) ? `${M0}월 가동 이후 최고`
    : "";

  const units = raw.units
    .map((u) => {
      const p = prev?.units.find((x) => x.name === u.name && x.gate === u.gate);
      return { ...u, rate: violationRate(u.violations, u.scans), prevRate: p ? violationRate(p.violations, p.scans) : null };
    })
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  const gears = (Object.keys(raw.gears) as Gear[])
    .map((g) => ({ gear: g, ...raw.gears[g], total: raw.gears[g].hq + raw.gears[g].sub }))
    .sort((a, b) => b.total - a.total);
  const slots = [...raw.slots]
    .sort((a, b) => b.violations - a.violations || a.hour - b.hour)
    .map((x) => ({ ...x, pct: cur.violations ? Math.round((x.violations / cur.violations) * 100) : 0 }));

  return {
    month,
    monthNo: m,
    prevMonthNo: m === 1 ? 12 : m - 1,
    title: `${y}년 ${m}월`,
    period: `${md(raw.from)} ~ ${md(raw.to)}`,
    workDays: raw.days,
    registered: raw.registered,
    entered: raw.entered,
    ...cur,
    prevRate: prevTotal?.rate ?? null,
    delta,
    rank,
    units,
    gates: [...new Set(raw.units.map((u) => u.gate))].sort().join("·"),
    gears,
    slots,
    start: `${Y0}. ${M0}. ${D0}.`,
  };
}

export type MonthlyReport = ReturnType<typeof buildReport>;

/** 목록용 — 최신 월이 위 */
export function listMonthlyReports(all: MonthlyRaw[]): MonthlyReport[] {
  return [...all].sort((a, b) => b.month.localeCompare(a.month)).map((r) => buildReport(r.month, all));
}
