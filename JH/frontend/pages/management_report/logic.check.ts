// 경영 리포트 계산 자체 점검 — 실행: node JH/frontend/pages/management_report/logic.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { REPORTS } from "./data.ts";
import { compareReport, computeReport, listReports, mockReport, ratio, scaleTo, withActual, withSafety } from "./logic.ts";

assert.equal(ratio(1, 0), null);
assert.equal(ratio(1, 4), 0.25);

// 목록: 최신순, 월 경계·연 경계
const now = new Date(2026, 10, 14, 9, 0); // 2026-11-14
const daily = listReports("daily", now);
assert.equal(daily.length, 14);
assert.deepEqual([daily[0].from, daily[0].to, daily[13].from], ["2026-11-14", "2026-11-14", "2026-11-01"]);
assert.equal(daily[0].title, "2026-11-14 일일 경영 리포트");
const weekly = listReports("weekly", now);
// 주간 = 달력 주 월~일, 이번 주는 월~오늘 (2026-11-14 = 토)
assert.deepEqual([weekly[0].from, weekly[0].to, weekly[1].from, weekly[1].to], ["2026-11-09", "2026-11-14", "2026-11-02", "2026-11-08"]);
const wk = (d: Date) => listReports("weekly", d, 2).map((r) => [r.from, r.to]);
assert.deepEqual(wk(new Date(2026, 10, 15)), [["2026-11-09", "2026-11-15"], ["2026-11-02", "2026-11-08"]]); // 일요일
assert.deepEqual(wk(new Date(2026, 10, 16)), [["2026-11-16", "2026-11-16"], ["2026-11-09", "2026-11-15"]]); // 월요일
assert.deepEqual(wk(new Date(2026, 0, 3)), [["2025-12-29", "2026-01-03"], ["2025-12-22", "2025-12-28"]]); // 연말 경계
const monthly = listReports("monthly", now);
assert.deepEqual(monthly.slice(0, 3).map((r) => [r.from, r.to]), [["2026-11-01", "2026-11-14"], ["2026-10-01", "2026-10-31"], ["2026-09-01", "2026-09-30"]]);
assert.equal(monthly[0].title, "2026년 11월 월간 경영 리포트");
assert.deepEqual(listReports("monthly", new Date(2026, 1, 10), 3).map((r) => r.to), ["2026-02-10", "2026-01-31", "2025-12-31"]);
assert.equal(new Set([...daily, ...weekly, ...monthly].map((r) => r.id)).size, 28); // id 유일

// 목업 리포트: 같은 id → 같은 값, 다른 id → 대체로 다른 값
assert.deepEqual(mockReport(REPORTS.daily, "a"), mockReport(REPORTS.daily, "a"));
assert.notDeepEqual(mockReport(REPORTS.daily, "a"), mockReport(REPORTS.daily, "b"));
const mocks = [...daily, ...weekly, ...monthly].map((it) => mockReport(REPORTS[it.period], it.id));

// 일일: 575개 × 85,000원, 불량 26개
const d = computeReport(REPORTS.daily, 85_000, 12_000);
assert.equal(d.amount, 48_875_000);
assert.equal(d.lossCost, 2_210_000);
assert.equal(d.spcTotal, 6);
assert.equal(d.recycleSaving, 372_000);
assert.deepEqual(d.gears.map(([g]) => g).includes("shoes"), false); // 0건 장구 제외
assert.deepEqual(computeReport(REPORTS.weekly, 1, 1).companies.map((c) => c.count), [7, 5, 3, 2]);

// 목업 무결성: 불량 ≤ 생산, 재활용 ≤ 1차 불량, 출근 ≤ 총원, 업체·장구 합계 = 위반 건수(장구는 1건에 여러 개 가능 → 이상)
for (const r of [...Object.values(REPORTS), ...mocks]) {
  assert.ok(r.defects <= r.production && r.defects <= r.firstDefects && r.recycled <= r.firstDefects && r.attendance.present <= r.attendance.total);
  assert.ok(r.safety.repeatViolators <= r.safety.violations);
  assert.equal(Object.values(r.defectTypes).reduce((a, n) => a + n, 0), r.defects); // 유형 합계 = 불량
  assert.equal(r.safety.byCompany.reduce((a, c) => a + c.count, 0), r.safety.violations);
  assert.ok(Object.values(r.safety.byGear).reduce((a, n) => a + n, 0) >= r.safety.violations);
}

// 비례 배분: 합계 정확히 일치, 0 합계는 그대로
assert.deepEqual(scaleTo({ a: 1, b: 1, c: 1 }, 10), { a: 4, b: 3, c: 3 });
assert.deepEqual(scaleTo({ a: 0, b: 0 }, 5), { a: 0, b: 0 });
assert.equal(Object.values(scaleTo({ a: 11, b: 7, c: 5, d: 3 }, 19)).reduce((x, y) => x + y, 0), 19);

// 순손실·인당 생산: 26×85,000 − 31×12,000 = 1,838,000 / 575 ÷ 121
assert.equal(d.netLoss, 1_838_000);
assert.ok(Math.abs(d.perCapita! - 575 / 121) < 1e-12);
assert.deepEqual(d.defectTypes.map(([k]) => k), ["porosity", "short_shot", "crack", "burr"]);

// 전기 대비: 위반 +1, 불량률 4% → 5% = +1%p, 직전 없으면 null
const base = REPORTS.daily;
const prev = { ...base, defects: 4, production: 100, safety: { ...base.safety, violations: 2 } };
const cur = { ...base, defects: 5, production: 100, safety: { ...base.safety, violations: 3 } };
const cmp = compareReport(cur, prev);
assert.equal(cmp.violations, 1);
assert.ok(Math.abs(cmp.defectRatePp! - 1) < 1e-9);
assert.deepEqual(compareReport(cur, null), { violations: null, defectRatePp: null });

// 실제 생산 합산: 기간 안의 날만, 목업 항목은 실제 불량과 모순 없게
const days = [
  { date: "2026-11-09", production: 100, defects: 5 },
  { date: "2026-11-10", production: 1000, defects: 40 },
  { date: "2026-11-11", production: 2000, defects: 60 },
];
const act = withActual(REPORTS.daily, days, "2026-11-10", "2026-11-11");
assert.deepEqual([act.production, act.defects, act.noData], [3000, 100, false]);
assert.ok(act.defects <= act.firstDefects && act.recycled <= act.firstDefects && act.firstDefects <= act.production);
assert.equal(Object.values(act.defectTypes).reduce((a, n) => a + n, 0), 100);
const none = withActual(REPORTS.daily, days, "2026-06-01", "2026-06-30");
assert.deepEqual([none.production, none.defects, none.firstDefects, none.recycled, none.noData], [0, 0, 0, 0, true]);
assert.equal(computeReport(none, 1, 1).defectRate, null); // 생산 0 → 불량률 「—」

// 실제 안전: 기간 안 위반만, 재위반 = 기간 안 2회 이상, 같은 이름이어도 본사·하청은 따로
const safetyData = {
  scans: [{ date: "2026-11-09", count: 50 }, { date: "2026-11-10", count: 40 }, { date: "2026-11-11", count: 60 }],
  violations: [
    { date: "2026-11-09", userId: "e0001", company: "생산부", vendor: false, missing: ["vest" as const] },
    { date: "2026-11-10", userId: "e0001", company: "생산부", vendor: false, missing: ["vest" as const, "gloves" as const] },
    { date: "2026-11-11", userId: "e0001", company: "생산부", vendor: false, missing: [] },
    { date: "2026-11-11", userId: "vc0001", company: "한빛", vendor: true, missing: ["helmet" as const] },
  ],
};
const sf = withSafety(REPORTS.daily, safetyData, "2026-11-10", "2026-11-11").safety;
assert.deepEqual([sf.scans, sf.violations, sf.repeatViolators], [100, 3, 1]);
assert.deepEqual(sf.byCompany.map((c) => [c.company, c.type, c.count]), [["생산부", "본사", 2], ["한빛", "하청업체", 1]]);
assert.deepEqual(sf.byGear, { helmet: 1, shoes: 0, vest: 1, gloves: 1, goggles: 0 });
assert.equal(withSafety(REPORTS.daily, safetyData, "2026-11-09", "2026-11-09").safety.repeatViolators, 0); // 하루 1회 → 재위반 아님

console.log("management_report logic: OK");
