// 경영 리포트 계산 자체 점검 — 실행: node JH/frontend/pages/management_report/logic.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import type { ReportSource } from "./data.ts";
import { buildReport, compareReport, computeReport, listReports, pickFixed, ratio } from "./logic.ts";

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

// 원자료 → 리포트: 기간 안의 날만 합산
const src: ReportSource = {
  daily: [
    { date: "2026-11-09", production: 100, defects: 5 },
    { date: "2026-11-10", production: 1000, defects: 40 },
    { date: "2026-11-11", production: 2000, defects: 60 },
  ],
  spc: [{ date: "2026-11-09", ucl: 9, lcl: 9 }, { date: "2026-11-10", ucl: 3, lcl: 1 }, { date: "2026-11-11", ucl: 2, lcl: 4 }],
  attendance: [{ date: "2026-11-09", scheduled: 50, present: 49 }, { date: "2026-11-10", scheduled: 54, present: 53 }, { date: "2026-11-11", scheduled: 54, present: 52 }],
  safety: {
    scans: [{ date: "2026-11-09", count: 50 }, { date: "2026-11-10", count: 40 }, { date: "2026-11-11", count: 60 }],
    violations: [
      { date: "2026-11-09", userId: "e0001", company: "생산부", vendor: false, missing: ["vest"] },
      { date: "2026-11-10", userId: "e0001", company: "생산부", vendor: false, missing: ["vest", "gloves"] },
      { date: "2026-11-11", userId: "e0001", company: "생산부", vendor: false, missing: [] },
      { date: "2026-11-11", userId: "vc0001", company: "한빛", vendor: true, missing: ["helmet"] },
    ],
  },
  fixed: [
    { name: "제품_단가", value: 85000, unit: "원/개", effectiveDate: "2026-08-01" },
    { name: "제품_단가", value: 90000, unit: "원/개", effectiveDate: "2026-11-11" },
    { name: "재활용_회수액", value: 12000, unit: "원/개", effectiveDate: "2026-08-01" },
    { name: "재활용률", value: 0.87, unit: "비율", effectiveDate: "2026-08-01" },
    { name: "MTTR", value: 1.5, unit: "시간", effectiveDate: "2026-12-01" },   // 아직 적용 전
  ],
};
const r = buildReport(src, "2026-11-10", "2026-11-11");
assert.deepEqual([r.production, r.defects, r.noData], [3000, 100, false]);
assert.deepEqual(r.spcAlarms, { ucl: 5, lcl: 5 });
assert.deepEqual(r.attendance, { total: 108, present: 105 });                 // 근무 예정자 · 출근 (연인원)
assert.deepEqual([r.safety.scans, r.safety.violations, r.safety.repeatViolators], [100, 3, 1]); // 재위반 = 기간 안 2회 이상
assert.deepEqual(r.safety.byCompany.map((c) => [c.company, c.type, c.count]), [["생산부", "본사", 2], ["한빛", "하청업체", 1]]);
assert.deepEqual(r.safety.byGear, { helmet: 1, shoes: 0, vest: 1, gloves: 1, goggles: 0 });
assert.equal(buildReport(src, "2026-11-09", "2026-11-09").safety.repeatViolators, 0); // 하루 1회 → 재위반 아님
assert.equal(r.fixed.unitPrice, 90000);                                        // 기간 마지막 날(11-11) 기준 최신 단가
assert.equal(buildReport(src, "2026-11-09", "2026-11-10").fixed.unitPrice, 85000);
assert.equal(r.fixed.mttr, null);                                              // 적용 전 → 미등록
const none = buildReport(src, "2026-06-01", "2026-06-30");
assert.deepEqual([none.production, none.noData, none.attendance.total], [0, true, 0]);

// 파생 지표: 3,000 × 90,000 / 불량 100 × 0.87 = 재활용 87개 × 12,000 = 1,044,000 / 순손실 9,000,000 − 1,044,000
const c = computeReport(r);
assert.equal(c.amount, 270_000_000);
assert.equal(c.lossCost, 9_000_000);
assert.equal(c.recycled, 87);
assert.equal(c.recycleSaving, 1_044_000);
assert.equal(c.netLoss, 7_956_000);
assert.ok(Math.abs(c.netLossRate! - 7_956_000 / 270_000_000) < 1e-12);
assert.equal(c.spcTotal, 10);
assert.ok(Math.abs(c.attendanceRate! - 105 / 108) < 1e-12);
assert.ok(Math.abs(c.perCapita! - 3000 / 105) < 1e-12);
assert.equal(c.gears.map(([g]) => g).includes("shoes"), false); // 0건 장구 제외
assert.equal(computeReport(none).defectRate, null);            // 생산 0 → 불량률 「—」

// 고정값 미등록 → 그 값으로 계산하는 항목은 null (가짜 값으로 계산 안 함)
const noFixed = computeReport({ ...r, fixed: pickFixed([], "2026-11-11") });
assert.deepEqual([noFixed.amount, noFixed.lossCost, noFixed.recycled, noFixed.netLoss, noFixed.netLossRate], [null, null, null, null, null]);
assert.equal(pickFixed(src.fixed, "2026-07-31").unitPrice, null);

// 전기 대비: 위반 +1, 불량률 4% → 5% = +1%p, 직전 없으면 null
const prev = { ...r, defects: 4, production: 100, safety: { ...r.safety, violations: 2 } };
const cur = { ...r, defects: 5, production: 100, safety: { ...r.safety, violations: 3 } };
const cmp = compareReport(cur, prev);
assert.equal(cmp.violations, 1);
assert.ok(Math.abs(cmp.defectRatePp! - 1) < 1e-9);
assert.deepEqual(compareReport(cur, null), { violations: null, defectRatePp: null });

console.log("management_report logic: OK");
