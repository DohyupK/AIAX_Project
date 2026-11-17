// 알람 규칙 자체 점검 — 실행: node JH/frontend/pages/process_optimization/alerts.check.ts (Node 23.6+)
import assert from 'node:assert/strict';
import { buildAlerts } from '../../common/casting/analysis.ts';
import type { ModelInfo, Shot } from '../../common/casting/types.ts';

const model = { bands: { cooling_water_temp: [29, 35, 45] } } as unknown as ModelInfo;
const shot = (id: number, v: number | null) => ({ shotId: id, time: `0:00:${id}`, prob: 0, actual: 0, features: { cooling_water_temp: v } }) as unknown as Shot;
// 정상 → 주의(46) → 주의 유지 → 이탈(60) → 결측 → 이탈 유지 → 정상 → 이탈
const a = buildAlerts([35, 46, 47, 60, null, 61, 35, 70].map((v, i) => shot(i + 1, v)), model, ['cooling_water_temp']).reverse();
assert.deepEqual(a.map(x => [x.shotId, x.critical]), [[2, false], [4, true], [8, true]]);
assert.match(a[0].message, /#2 주의: 냉각수 온도 46\.0°C \(정상 29\.0~45\.0\)/);
console.log('alerts.check OK');
