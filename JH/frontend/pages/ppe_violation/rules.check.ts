// 판정 규칙·월간 보고서 계산 자체 점검 — 실행: node JH/frontend/pages/ppe_violation/rules.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { gearStatus, missingGear, violationMessage } from "./rules.ts";
import { buildReport, listMonthlyReports, violationRate, type MonthlyRaw } from "./monthly.ts";

const ALL = ["helmet", "shoes", "vest", "gloves", "goggles"] as const;

// 게이트 a: 5종 모두 필수 (DB ai.ppe_gate_rule a 와 같음)
assert.deepEqual(missingGear("a", [...ALL]), []);
assert.deepEqual(missingGear("a", ["helmet", "shoes", "vest", "gloves"]), ["goggles"]);
// 게이트 b: 보안경 제외 4종만 검사 — 보안경이 없어도 통과
assert.deepEqual(missingGear("b", ["helmet", "shoes", "vest", "gloves"]), []);
assert.deepEqual(missingGear("b", ["helmet", "shoes", "vest"]), ["gloves"]);
// 판정 불가 장구는 미착용이 아니라 unknown
assert.deepEqual(gearStatus("b", ["helmet"], ["shoes", "vest", "gloves"]).map((g) => g.status),
  ["worn", "unknown", "unknown", "unknown"]);
// 게이트 b 화면 항목은 4개 (보안경 표시 없음)
assert.deepEqual(gearStatus("b", [...ALL]).map((g) => g.gear), ["helmet", "shoes", "vest", "gloves"]);
assert.equal(gearStatus("a", []).length, 5);
// 안내 문구 조사
assert.equal(violationMessage(["gloves"]), "장갑을 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");
assert.equal(violationMessage(["helmet"]), "안전모를 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");
assert.equal(violationMessage(["goggles", "vest"]), "보안경, 조끼를 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");

// 월간 보고서: API(/api/ppe/monthly) 응답 형식의 고정 원자료로 계산 확인
const gear = (hq: number, sub: number) => ({ hq, sub });
const RAW: MonthlyRaw[] = [
  {
    month: "2026-08", from: "2026-08-04", to: "2026-08-31", days: 20, registered: 59, entered: 59,
    units: [
      { name: "생산부", type: "본청", gate: "a", scans: 1000, violations: 40 },
      { name: "대성기공", type: "협력업체", gate: "b", scans: 500, violations: 10 },
    ],
    gears: { helmet: gear(1, 0), shoes: gear(0, 0), vest: gear(2, 1), gloves: gear(30, 9), goggles: gear(8, 0) },
    slots: [{ hour: 5, violations: 20 }, { hour: 8, violations: 30 }],
  },
  {
    month: "2026-09", from: "2026-09-01", to: "2026-09-30", days: 22, registered: 59, entered: 58,
    units: [
      { name: "대성기공", type: "협력업체", gate: "b", scans: 500, violations: 20 },
      { name: "생산부", type: "본청", gate: "a", scans: 1000, violations: 10 },
    ],
    gears: { helmet: gear(0, 0), shoes: gear(0, 0), vest: gear(0, 5), gloves: gear(10, 15), goggles: gear(0, 0) },
    slots: [{ hour: 8, violations: 20 }, { hour: 13, violations: 10 }],
  },
];
const sep = buildReport("2026-09", RAW);
assert.equal(sep.scans, 1500);
assert.equal(sep.violations, 30);
assert.equal(sep.rate, 20);
assert.equal(sep.prevRate, 33.3);
assert.equal(sep.delta, -13.3);
assert.equal(sep.workDays, 22);
assert.equal(sep.period, "9. 1. ~ 9. 30.");
assert.equal(sep.rank, "8월 가동 이후 최저");
assert.equal(sep.start, "2026. 8. 4.");
assert.equal(sep.gates, "a·b");
// 소속은 위반율 높은 순, 전월은 같은 이름·게이트끼리
assert.deepEqual(sep.units.map((u) => [u.name, u.rate, u.prevRate]), [["대성기공", 40, 20], ["생산부", 10, 40]]);
assert.deepEqual(sep.gears.map((g) => [g.gear, g.total]).slice(0, 2), [["gloves", 25], ["vest", 5]]);
assert.deepEqual(sep.slots, [{ hour: 8, violations: 20, pct: 67 }, { hour: 13, violations: 10, pct: 33 }]);
// 첫 달은 비교 없음
const aug = buildReport("2026-08", RAW);
assert.equal(aug.rank, "가동 첫 달");
assert.equal(aug.delta, null);
assert.equal(aug.period, "8. 4. ~ 8. 31.");
assert.equal(violationRate(1, 0), null);
assert.throws(() => buildReport("2025-01", RAW));
assert.deepEqual(listMonthlyReports(RAW).map((r) => r.month), ["2026-09", "2026-08"]);

console.log("ppe_violation rules: OK");
