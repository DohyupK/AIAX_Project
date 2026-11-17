// 월간 보호구 착용 위반 보고서 — 원자료(목업) + 계산 (화면·CSS import 없음) — 자체 점검: rules.check.ts
// 타입만 import → node 단독 실행 가능. 집계 API 연동 시 MONTHLY_RAW 만 API 조회로 교체하면 계산은 그대로 씀
import type { Gate, Gear } from "./rules";

/** 설비 가동일 — 집계 시작 */
export const OPERATION_START = "2026-08-04";
export const SITE = "알루미늄 다이캐스팅 주조동 · 보호구 게이트 A(주조)·B(품질 검사)";
/** 교대 직후 시간대 (④ 시간대 집계 기준) */
export const PEAK_LABEL = "교대 직후(07:30~08:30)";

export type UnitType = "본청" | "협력업체";

/** 한 달 원자료 — 사람이 세는 값만 두고, 비율·합계·순위는 아래 함수가 계산 */
export interface MonthlyRaw {
  month: string;      // 'YYYY-MM'
  holidays: string[]; // 'YYYY-MM-DD' 평일 휴무
  registered: number; // 등록 인원
  entered: number;    // 실제 출입 인원
  units: { name: string; type: UnitType; gate: Gate; scans: number; violations: number }[];
  gears: Record<Gear, { hq: number; sub: number }>; // 보호구별 미착용 개수 (본청 / 협력업체)
  peakViolations: number;       // 교대 직후 위반 건수
  gearPeak: Record<Gear, number>; // 보호구별 교대 직후 개수
}

// 가상 데이터. 10월 = 출력본 PDF 값, 9월 = PDF 전월 위반율에 맞춘 값, 8월 = 가동 첫 달 가상 값
export const MONTHLY_RAW: MonthlyRaw[] = [
  {
    month: "2026-10", holidays: ["2026-10-05", "2026-10-09"], registered: 57, entered: 57,
    units: [
      { name: "(주)한빛정밀", type: "협력업체", gate: "B", scans: 366, violations: 18 },
      { name: "대성기공", type: "협력업체", gate: "A", scans: 466, violations: 15 },
      { name: "생산부", type: "본청", gate: "A", scans: 726, violations: 18 },
      { name: "품질부", type: "본청", gate: "B", scans: 185, violations: 2 },
    ],
    gears: { gloves: { hq: 12, sub: 16 }, vest: { hq: 3, sub: 9 }, goggles: { hq: 4, sub: 4 }, helmet: { hq: 1, sub: 4 }, shoes: { hq: 1, sub: 2 } },
    peakViolations: 32,
    gearPeak: { gloves: 21, vest: 7, goggles: 5, helmet: 3, shoes: 2 },
  },
  {
    month: "2026-09", holidays: ["2026-09-24", "2026-09-25"], registered: 57, entered: 56,
    units: [
      { name: "(주)한빛정밀", type: "협력업체", gate: "B", scans: 358, violations: 20 },
      { name: "대성기공", type: "협력업체", gate: "A", scans: 467, violations: 17 },
      { name: "생산부", type: "본청", gate: "A", scans: 697, violations: 19 },
      { name: "품질부", type: "본청", gate: "B", scans: 177, violations: 2 },
    ],
    gears: { gloves: { hq: 13, sub: 17 }, vest: { hq: 4, sub: 10 }, goggles: { hq: 4, sub: 5 }, helmet: { hq: 2, sub: 4 }, shoes: { hq: 1, sub: 2 } },
    peakViolations: 36,
    gearPeak: { gloves: 22, vest: 8, goggles: 5, helmet: 3, shoes: 2 },
  },
  {
    month: "2026-08", holidays: ["2026-08-17"], registered: 55, entered: 55,
    units: [
      { name: "(주)한빛정밀", type: "협력업체", gate: "B", scans: 330, violations: 22 },
      { name: "대성기공", type: "협력업체", gate: "A", scans: 420, violations: 18 },
      { name: "생산부", type: "본청", gate: "A", scans: 650, violations: 22 },
      { name: "품질부", type: "본청", gate: "B", scans: 160, violations: 3 },
    ],
    gears: { gloves: { hq: 15, sub: 19 }, vest: { hq: 5, sub: 11 }, goggles: { hq: 5, sub: 5 }, helmet: { hq: 2, sub: 5 }, shoes: { hq: 1, sub: 3 } },
    peakViolations: 41,
    gearPeak: { gloves: 25, vest: 9, goggles: 6, helmet: 3, shoes: 2 },
  },
];

/** 위반율(1,000회당), 소수 1자리. 판정 0이면 null */
export function violationRate(violations: number, scans: number): number | null {
  return scans ? Math.round((violations / scans) * 10000) / 10 : null;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const [Y0, M0, D0] = OPERATION_START.split("-").map(Number);

/** 'YYYY-MM-DD' → '10. 5.' */
const md = (d: string) => `${Number(d.slice(5, 7))}. ${Number(d.slice(8, 10))}.`;

/** 가동일 = 그 달 평일(가동 시작일 이후) − 평일 휴무 */
export function workDays(raw: MonthlyRaw): { from: string; to: string; days: number } {
  const [y, m] = raw.month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const first = y === Y0 && m === M0 ? D0 : 1;
  let days = 0;
  for (let d = first; d <= last; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    const iso = `${raw.month}-${String(d).padStart(2, "0")}`;
    if (dow !== 0 && dow !== 6 && !raw.holidays.includes(iso)) days++;
  }
  const pad = (d: number) => `${raw.month}-${String(d).padStart(2, "0")}`;
  return { from: pad(first), to: pad(last), days };
}

export function totals(raw: MonthlyRaw) {
  const scans = sum(raw.units.map((u) => u.scans));
  const violations = sum(raw.units.map((u) => u.violations));
  return { scans, violations, rate: violationRate(violations, scans) };
}

/** 보고서 한 장에 들어갈 값 전부 */
export function buildReport(month: string, all: MonthlyRaw[] = MONTHLY_RAW) {
  const raw = all.find((r) => r.month === month);
  if (!raw) throw new Error(`보고서 원자료 없음: ${month}`);
  const [y, m] = month.split("-").map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const prev = all.find((r) => r.month === prevMonth);

  const cur = totals(raw);
  const prevTotal = prev ? totals(prev) : null;
  const delta = cur.rate !== null && prevTotal?.rate != null ? Math.round((cur.rate - prevTotal.rate) * 10) / 10 : null;

  // 가동 이후 이 달까지 중 최저/최고 (첫 달이면 비교 없음)
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
    .map((g) => ({ gear: g, ...raw.gears[g], total: raw.gears[g].hq + raw.gears[g].sub, peak: raw.gearPeak[g] }))
    .sort((a, b) => b.total - a.total);
  const top = gears[0];

  const wd = workDays(raw);
  return {
    month,
    monthNo: m,
    prevMonthNo: m === 1 ? 12 : m - 1,
    title: `${y}년 ${m}월`,
    period: `${md(wd.from)} ~ ${md(wd.to)}`,
    workDays: wd.days,
    holidays: raw.holidays.map(md),
    registered: raw.registered,
    entered: raw.entered,
    ...cur,
    prevRate: prevTotal?.rate ?? null,
    delta,
    rank,
    units,
    gates: [...new Set(raw.units.map((u) => u.gate))].sort().join("·"),
    gears,
    peak: raw.peakViolations,
    peakPct: cur.violations ? Math.round((raw.peakViolations / cur.violations) * 100) : 0,
    offPeak: cur.violations - raw.peakViolations,
    top: top && { gear: top.gear, peak: top.peak, offPeak: top.total - top.peak },
    start: `${Y0}. ${M0}. ${D0}.`,
  };
}

export type MonthlyReport = ReturnType<typeof buildReport>;

/** 목록용 — 최신 월이 위 */
export function listMonthlyReports(all: MonthlyRaw[] = MONTHLY_RAW): MonthlyReport[] {
  return [...all].sort((a, b) => b.month.localeCompare(a.month)).map((r) => buildReport(r.month, all));
}
