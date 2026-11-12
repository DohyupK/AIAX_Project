// 관리 한계(I-MR·EWMA)·Nelson 규칙 자체 점검 — 실행: node JH/frontend/pages/process_optimization/spc.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { EWMA_LAMBDA, ewmaLimits, ewmaSeries, nelsonFlags, spcLimits } from "../../common/casting/analysis.ts";

// I-MR: [10,12,10,12] → CL 11, MR̄ 2 → UCL 11+5.32, LCL 11-5.32
assert.equal(spcLimits([]), null);
assert.equal(spcLimits([5]), null);
const a = spcLimits([10, 12, 10, 12])!;
assert.equal(a.cl, 11);
assert.ok(Math.abs(a.ucl - 16.32) < 1e-9 && Math.abs(a.lcl - 5.68) < 1e-9);

// 기준 구간의 한계 밖 점은 빼고 재계산
const base = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 50];
const b = spcLimits(base)!;
assert.equal(b.n, 20);
assert.equal(b.cl, 10.5);

const lim = { cl: 0, ucl: 10, lcl: -10, n: 0 };
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

// EWMA: [2,4] → CL 3, σ(표본) √2 → 폭 3·√2·√(0.2/1.8) = √2
assert.equal(ewmaLimits([5]), null);
const e = ewmaLimits([2, 4])!;
assert.equal(e.cl, 3);
assert.ok(Math.abs(e.ucl - (3 + Math.SQRT2)) < 1e-9 && Math.abs(e.lcl - (3 - Math.SQRT2)) < 1e-9);
// z_1 = 0.2·10 + 0.8·0 = 2, z_2 = 0.2·10 + 0.8·2 = 3.6
assert.equal(EWMA_LAMBDA, 0.2);
const z = ewmaSeries([10, 10], 0);
assert.ok(Math.abs(z[0] - 2) < 1e-9 && Math.abs(z[1] - 3.6) < 1e-9);
// 기준 구간의 평균 ± 3σ 밖 샷은 빼고 재계산
const eb = ewmaLimits([...Array.from({ length: 30 }, (_, i) => 100 + (i % 3)), 1000])!;
assert.equal(eb.n, 30);

console.log("spc.check OK");
