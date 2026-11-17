// 판정 규칙·월간 보고서 계산 자체 점검 — 실행: node JH/frontend/pages/ppe_violation/rules.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { missingGear, violationMessage } from "./rules.ts";
import { MONTHLY_RAW, buildReport, listMonthlyReports, violationRate } from "./monthly.ts";

const ALL = ["helmet", "shoes", "vest", "gloves", "goggles"] as const;

// 게이트 A: 5종 모두 필수
assert.deepEqual(missingGear("A", [...ALL]), []);
assert.deepEqual(missingGear("A", ["helmet", "shoes", "vest", "gloves"]), ["goggles"]);
// 게이트 B: 보안경은 선택이라 없어도 통과
assert.deepEqual(missingGear("B", ["helmet", "shoes", "vest", "gloves"]), []);
assert.deepEqual(missingGear("B", ["helmet", "shoes", "vest"]), ["gloves"]);
// 안내 문구 조사
assert.equal(violationMessage(["gloves"]), "장갑을 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");
assert.equal(violationMessage(["helmet"]), "안전모를 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");
assert.equal(violationMessage(["goggles", "vest"]), "보안경, 조끼를 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");

// 월간 보고서: 10월 = 출력본 PDF 값과 같아야 함
const oct = buildReport("2026-10");
assert.equal(oct.scans, 1743);
assert.equal(oct.violations, 53);
assert.equal(oct.rate, 30.4);
assert.equal(oct.prevRate, 34.1);
assert.equal(oct.delta, -3.7);
assert.equal(oct.workDays, 20);
assert.equal(oct.period, "10. 1. ~ 10. 31.");
assert.equal(oct.rank, "8월 가동 이후 최저");
assert.deepEqual(oct.units.map((u) => [u.name, u.rate, u.prevRate]), [
  ["(주)한빛정밀", 49.2, 55.9], ["대성기공", 32.2, 36.4], ["생산부", 24.8, 27.3], ["품질부", 10.8, 11.3],
]);
assert.deepEqual(oct.gears.map((g) => [g.gear, g.total, g.hq, g.sub]), [
  ["gloves", 28, 12, 16], ["vest", 12, 3, 9], ["goggles", 8, 4, 4], ["helmet", 5, 1, 4], ["shoes", 3, 1, 2],
]);
assert.deepEqual([oct.peak, oct.peakPct, oct.offPeak], [32, 60, 21]);
assert.deepEqual(oct.top, { gear: "gloves", peak: 21, offPeak: 7 });
assert.deepEqual(oct.holidays, ["10. 5.", "10. 9."]);
assert.equal(oct.start, "2026. 8. 4.");
// 첫 달은 비교 없음, 가동 시작일부터 셈
const aug = buildReport("2026-08");
assert.equal(aug.rank, "가동 첫 달");
assert.equal(aug.delta, null);
assert.equal(aug.period, "8. 4. ~ 8. 31.");
assert.equal(violationRate(1, 0), null);
assert.throws(() => buildReport("2025-01"));
assert.deepEqual(listMonthlyReports().map((r) => r.month), ["2026-10", "2026-09", "2026-08"]);
// 원자료 정합: 교대 직후 ≤ 전체, 보호구 개수 ≥ 위반 건수(한 건에 여러 개 가능)
for (const r of MONTHLY_RAW) {
  const rep = buildReport(r.month);
  assert.ok(r.peakViolations <= rep.violations, r.month);
  for (const g of rep.gears) assert.ok(g.peak <= g.total, `${r.month} ${g.gear}`);
  assert.ok(rep.gears.reduce((a, g) => a + g.total, 0) >= rep.violations, r.month);
}

console.log("ppe_violation rules: OK");
