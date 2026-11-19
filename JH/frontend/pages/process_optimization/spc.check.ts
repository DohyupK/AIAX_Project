// 관리도 기준선 표·Nelson 규칙·EWMA 자체 점검 — 실행: node JH/frontend/pages/process_optimization/spc.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { EWMA_LAMBDA, ewmaSeries, nelsonFlags } from "../../common/casting/analysis.ts";
import { spcBaseline } from "../../common/casting/spcLimits.ts";
import { FEATURES } from "../../common/casting/types.ts";

// 기준선 표: 3라인 × 13변수, 표 값이 공식과 맞는지 (반올림 오차 0.05 이내) — 옮겨 적다 틀린 숫자 잡기
const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) <= 0.05, `${what}: ${a} ≠ ${b}`);
let rows = 0;
for (const line of ["line_no1", "line_no2", "line_no3"]) {
  for (const k of FEATURES) {
    const b = spcBaseline(line, k);
    if (k === "top_temp3" || k === "bottom_temp3") { assert.equal(b, null); continue; }
    assert.ok(b, `${line} ${k} 기준선 없음`);
    rows++;
    near(b.iUcl, b.cl + 3 * b.sigma, `${line} ${k} I UCL`);
    near(b.iLcl, b.cl - 3 * b.sigma, `${line} ${k} I LCL`);
    near(b.mrUcl, 3.267 * b.mrCl, `${line} ${k} MR UCL`);
    near(b.sigma, b.mrCl / 1.128, `${line} ${k} σ = MR̄/d2`);
    const w = 3 * b.sigma * Math.sqrt(EWMA_LAMBDA / (2 - EWMA_LAMBDA)); // = 1σ
    near(b.ewmaUcl, b.cl + w, `${line} ${k} EWMA UCL`);
    near(b.ewmaLcl, b.cl - w, `${line} ${k} EWMA LCL`);
  }
}
assert.equal(rows, 39);
assert.equal(spcBaseline("line_no9", "top_temp1"), null);

const lim = { cl: 0, ucl: 10, lcl: -10 };
const has = (f: number[][], i: number, r: number) => f[i].includes(r);

// 규칙 1
assert.ok(has(nelsonFlags([0, 11, -11, 5], lim), 1, 1));
assert.ok(has(nelsonFlags([0, 11, -11, 5], lim), 2, 1));
assert.deepEqual(nelsonFlags([0, 11, -11, 5], lim)[3], []);

// 규칙 2: 9점 연속 위쪽은 표시, 8점은 표시 안 함
const up9 = [1, 2, 1, 2, 1, 2, 1, 2, 1, -1];
assert.ok(nelsonFlags(up9, lim).slice(0, 9).every(f => f.includes(2)));
assert.ok(!nelsonFlags(up9, lim)[9].includes(2));
assert.ok(!nelsonFlags([1, 2, 1, 2, 1, 2, 1, 2, -1], lim).some(f => f.includes(2)));

// 규칙 3: 6점 연속 상승은 표시, 5점은 표시 안 함, 같은 값은 끊김
assert.ok(nelsonFlags([1, 2, 3, 4, 5, 6], lim).every(f => f.includes(3)));
assert.ok(!nelsonFlags([1, 2, 3, 4, 5, 4], lim).some(f => f.includes(3)));
assert.ok(!nelsonFlags([1, 2, 3, 3, 4, 5, 6], lim).some(f => f.includes(3)));
// 하강 6점 (상승 구간 뒤 전환점부터 시작)
const down = nelsonFlags([0, 6, 5, 4, 3, 2, 1], lim);
assert.ok(down.slice(1).every(f => f.includes(3)) && !down[0].includes(3));

// z_1 = 0.2·10 + 0.8·0 = 2, z_2 = 0.2·10 + 0.8·2 = 3.6
assert.equal(EWMA_LAMBDA, 0.2);
const z = ewmaSeries([10, 10], 0);
assert.ok(Math.abs(z[0] - 2) < 1e-9 && Math.abs(z[1] - 3.6) < 1e-9);

console.log("spc.check OK");
