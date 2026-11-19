// 1차·2차 판정 자체 점검 — 실행: node JH/frontend/pages/quality_inspection/inspection.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { confusion, rate, secondOf, summarize, topDeviations } from "./inspection.ts";
import type { ModelInfo, SecondResult, Shot } from "../../common/casting/types";

const shot = (prob: number, actual: 0 | 1 | null, f: Partial<Shot["features"]> = {}, castingId?: string) =>
  ({ shotId: 1, time: "0:00:00", prob, actual, features: f, castingId }) as Shot;
const dl = (castingId: string, result: "pass" | "fail"): SecondResult =>
  ({ castingId, modelName: "m", version: "", result, confidenceScore: result === "fail" ? 0.9 : 0.1, predictedAt: "" });
const RESULTS = new Map([["a", dl("a", "fail")], ["b", dl("b", "pass")], ["c", dl("c", "fail")]]);

// 1차 불량 → 2차 대상 아님(DL 결과가 있어도) / 1차 양품 → DL 결과, 이미지 없으면 noImage
assert.equal(secondOf(shot(0.5, 0, {}, "c"), 0.5, RESULTS), "first"); // 임계값과 같으면 1차 불량
assert.equal((secondOf(shot(0.2, 0, {}, "a"), 0.5, RESULTS) as SecondResult).result, "fail");
assert.equal(secondOf(shot(0.2, 1, {}, "z"), 0.5, RESULTS), "noImage");
assert.equal(secondOf(shot(0.2, 1), 0.5, RESULTS), "noImage"); // castingId 없는 샷

// 1차 불량 1(c) + 2차 검사 2(a 불량, b 양품) + 이미지 없음 1 → 최종 2, 2차 대상 3
assert.deepEqual(
  summarize([shot(0.1, 0, {}, "a"), shot(0.1, 0, {}, "b"), shot(0.7, 0, {}, "c"), shot(0.1, 1, {}, "z")], 0.5, RESULTS),
  { total: 4, first: 1, secondTargets: 3, inspected: 2, second: 1, final: 2 },
);
assert.deepEqual(summarize([], 0.5, RESULTS), { total: 0, first: 0, secondTargets: 0, inspected: 0, second: 0, final: 0 });
assert.equal(rate(1, 0), null);
assert.equal(rate(1, 4), 25);

// 결측 제외, 벗어난 정도 큰 순
const model = { bands: { injection_pressure: [0, 10, 20], sleeve_temperature: [0, 10, 20], top_temp1: [0, 10, 20] } } as unknown as ModelInfo;
const top = topDeviations(shot(0, 0, { injection_pressure: 12, sleeve_temperature: 30, top_temp1: null }), model, 2);
assert.deepEqual(top.map(t => t.key), ["sleeve_temperature", "injection_pressure"]);
assert.equal(top[0].score, 2);

// 1차 vs 실제: 기준값과 같으면 1차 불량, 실제 판정 없는 샷은 비교 제외
{
  const c = confusion([shot(0.9, 1), shot(0.5, 0), shot(0.2, 1), shot(0.1, 0), shot(0.1, 0), shot(0.8, null)], 0.5);
  assert.deepEqual([c.tp, c.fp, c.fn, c.tn, c.unjudged], [1, 1, 1, 2, 1]);
  assert.equal(c.recall, 0.5);
  assert.equal(c.precision, 0.5);
  const empty = confusion([], 0.5);
  assert.equal(empty.recall, null);
  assert.equal(empty.precision, null);
}

console.log("inspection.check OK");
