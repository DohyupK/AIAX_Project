// 1차·2차 판정 자체 점검 — 실행: node JH/frontend/pages/quality_inspection/inspection.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { rate, secondFail, summarize, topDeviations } from "./inspection.ts";
import type { ModelInfo, Shot } from "../../common/casting/types";

const shot = (prob: number, actual: 0 | 1 | null, f: Partial<Shot["features"]> = {}) =>
  ({ shotId: 1, time: "0:00:00", prob, actual, features: f }) as Shot;

// 1차 불량 → 2차 대상 아님(불량 확정) / 1차 패스 → 실제 라벨로 2차 판정
assert.equal(secondFail(shot(0.5, 0), 0.5), null); // 임계값과 같으면 1차 불량
assert.equal(secondFail(shot(0.9, 1), 0.5), null);
assert.equal(secondFail(shot(0.2, 1), 0.5), true);
assert.equal(secondFail(shot(0.2, 0), 0.5), false);
assert.equal(secondFail(shot(0.2, null), 0.5), false);

// 1차 불량 1 + 2차 불량 1(0.1 실제 불량) = 최종 2, 2차 대상 = 1차 패스 2샷
assert.deepEqual(summarize([shot(0.1, 1), shot(0.3, 0), shot(0.7, 0)], 0.5), { total: 3, first: 1, second: 1, secondTargets: 2, final: 2 });
assert.deepEqual(summarize([], 0.5), { total: 0, first: 0, second: 0, secondTargets: 0, final: 0 });
assert.equal(rate(1, 0), null);
assert.equal(rate(1, 4), 25);

// 결측 제외, 벗어난 정도 큰 순
const model = { bands: { injection_pressure: [0, 10, 20], sleeve_temperature: [0, 10, 20], top_temp1: [0, 10, 20] } } as unknown as ModelInfo;
const top = topDeviations(shot(0, 0, { injection_pressure: 12, sleeve_temperature: 30, top_temp1: null }), model, 2);
assert.deepEqual(top.map(t => t.key), ["sleeve_temperature", "injection_pressure"]);
assert.equal(top[0].score, 2);

console.log("inspection.check OK");
