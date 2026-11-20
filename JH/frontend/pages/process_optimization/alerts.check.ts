// 관리도 알림 규칙 자체 점검 (명세 3~5장) — 실행: node JH/frontend/pages/process_optimization/alerts.check.ts (Node 23.6+)
import assert from 'node:assert/strict';
import { buildAlertCards, type ControlLimits, type Limit } from '../../common/casting/alerts.ts';
import { LABELS } from '../../common/casting/analysis.ts';
import type { FeatureKey, Shot } from '../../common/casting/types.ts';

// 관리선 = line_no1 표 (spc.py) 중 일부
const L = (cl: number, sigma: number, mrUcl: number): Limit => ({
  cl, sigma, iLcl: cl - 3 * sigma, iUcl: cl + 3 * sigma, mrCl: mrUcl / 3.267, mrUcl, ewmaLcl: cl - sigma, ewmaUcl: cl + sigma,
});
const limits: ControlLimits = {
  line: 'line_no1', baselineFrom: '2026-10-12', baselineTo: '2026-10-18', judgeFrom: '2026-10-19', lambda: 0.2,
  variables: {
    mold_temperature: L(589.83, 6.62, 24.39), sleeve_temperature: L(377.97, 7.0, 25.79),
    injection_pressure: L(657.84, 1.19, 4.38), biscuit_thickness: L(149.43, 3.45, 12.7),
    molten_capacity: L(14.85, 5.07, 18.67), top_temp1: L(374.95, 26.16, 96.39), top_temp2: L(371.56, 9.72, 35.84),
  },
};
// 모두 중심선 값인 정상 샷 + 바꿀 값만 덮어씀 (넬슨 2가 걸리지 않게 CL 위아래를 번갈아)
let n = 0;
const shot = (id: number, f: Partial<Record<FeatureKey, number | null>> = {}): Shot => {
  const alt = n++ % 2 ? 0.1 : -0.1;
  const base = Object.fromEntries(Object.entries(limits.variables).map(([k, l]) => [k, l!.cl + alt * l!.sigma]));
  return { shotId: id, time: `13:${String(id % 60).padStart(2, '0')}:00`, prob: 0, actual: 0, features: { ...base, ...f } } as unknown as Shot;
};
const run = (shots: Shot[], date = '2026-11-20') => buildAlertCards(shots, limits, date, LABELS);

// 1) 넬슨 1 (주의) — 처음 벗어날 때만, 풀렸다가 다시 벗어나면 다시. 카드 4줄 형식
{
  const c = run([shot(1058), shot(1059, { mold_temperature: 567 }), shot(1060, { mold_temperature: 566 }), shot(1061), shot(1062, { mold_temperature: 565 })]);
  // 1060: 넬슨 1 은 계속 걸려 있어 다시 안 뜨고 EWMA 가 새로 걸림(관찰) / 1061: 크게 되돌아옴 → MR(관찰)
  assert.deepEqual(c.map(x => [x.shotId, x.grade, x.vars[0].rule]),
    [[1059, 'caution', 'n1'], [1060, 'watch', 'ewma'], [1061, 'watch', 'mr'], [1062, 'caution', 'n1']]);
  assert.equal(c[1].title, '#1060 용융온도 수준 서서히 하강');
  assert.equal(c[0].head, '주의 · 2026-11-20 13:39 · line_no1 · #1059');
  assert.equal(c[0].title, '#1059 용융온도 정상 범위 이탈 (낮음)');
  assert.deepEqual(c[0].details, ['용융온도 567.0 (관리선 570.0 ~ 609.7)']);
  assert.equal(c[0].guide, '용융온도 낮음: 보온로 히터와 잉곳 투입 직후인지 확인하세요.');
}

// 2) 경보 — 다른 변수 판정 안 함, 3줄 = 한계값
{
  const c = run([shot(101), shot(102, { injection_pressure: 582, mold_temperature: 500 })]);
  assert.equal(c.length, 1);
  assert.equal(c[0].grade, 'alarm');
  assert.equal(c[0].title, '#102 주입 압력 설비 한계 이탈 (600 미만)');
  assert.deepEqual(c[0].details, ['주입 압력 582 (한계 600)']);
  assert.equal(c[0].guide, '주입 압력 한계 미달: 어큐뮬레이터와 유압 장치를 점검하세요.');
}

// 3) 넬슨 2 (관찰) — 9점째에 한 번, 10·11점째는 없음. 런이 바뀌면 다시 셈
{
  const up = (id: number) => shot(id, { sleeve_temperature: 380 }); // CL 377.97 위, 관리선 안 (EWMA 는 384.96 밑)
  const c = run([...Array.from({ length: 11 }, (_, i) => up(i + 1)), up(1), ...Array.from({ length: 8 }, (_, i) => up(i + 2))]);
  assert.deepEqual(c.map(x => x.shotId), [9, 9]);
  assert.equal(c[0].title, '#9 슬리브 온도 평균 이동 (높은 쪽, 9샷)');
  assert.equal(c[0].guide, '슬리브 온도 평균 상승: 슬리브 냉각 부족과 용탕 온도 상승을 확인하세요.');
}

// 4) 판정 제외 — 용융온도 0·용탕량 > 100 은 그 변수만 건너뜀 / 판정 시작일(10-19) 앞(기준 기간 포함)은 판정 안 함
{
  assert.equal(run([shot(1), shot(2, { mold_temperature: 0, molten_capacity: 250 })]).length, 0);
  assert.equal(run([shot(1), shot(2, { mold_temperature: 500 })], '2026-10-11').length, 0);
  assert.equal(run([shot(1), shot(2, { mold_temperature: 500 })], '2026-10-18').length, 0);
  assert.equal(run([shot(1), shot(2, { mold_temperature: 500 })], '2026-10-19').length, 1);
}

// 5) 같은 샷 여러 변수 → 카드 한 장 (제목 = |z| 큰 변수, 외 N건) + 부록 B 함께 볼 곳
{
  const c = run([shot(1), shot(2, { biscuit_thickness: 138, molten_capacity: null })]);
  assert.equal(c.length, 1);
  const d = run([shot(1), shot(2, { biscuit_thickness: 120 + 18, mold_temperature: 560 })]);
  assert.equal(d[0].title, '#2 용융온도 정상 범위 이탈 (낮음) 외 1건'); // z: 용융 -4.5 > 비스켓 -3.3
  assert.equal(d[0].details.length, 2);
  // 상형 온도1·2 함께 낮음 → 5줄 부록 B
  const e = run([shot(1), shot(2, { top_temp1: 290, top_temp2: 340 })]);
  assert.equal(e[0].extra, '상형 전체 온도 하락: 직전 정지 여부와 상형 온조기를 확인하세요.');
  assert.match(e[0].title, /^#2 상금형온도 1 정상 범위 이탈 \(낮음\) 외 1건$/);
}

// 6) 다른 샷 관련 변수 (5샷 창) → 5줄 「최근 관련 알림」
{
  const c = run([shot(1093), shot(1094, { injection_pressure: 650 }), shot(1095, { biscuit_thickness: 139 })]);
  assert.deepEqual(c.map(x => x.shotId), [1094, 1095]);
  assert.equal(c[1].extra, '최근 관련 알림: #1094 주입 압력 정상 범위 이탈 (낮음), 1샷 전');
  const far = run([shot(1), shot(2, { injection_pressure: 650 }), ...[3, 4, 5, 6, 7].map(i => shot(i)), shot(8, { biscuit_thickness: 139 })]);
  assert.equal(far[far.length - 1].extra, null); // 6샷 전은 창 밖
}

// 7) MR 1 — 앞 판정 샷과의 차이, 빈 값 샷은 건너뛰고 그 전 샷과 비교
{
  const c = run([shot(1, { injection_pressure: 656 }), shot(2, { injection_pressure: null }), shot(3, { injection_pressure: 661 })]);
  assert.equal(c.length, 1);
  assert.equal(c[0].title, '#3 주입 압력 샷 간 흔들림');
  assert.deepEqual(c[0].details, ['주입 압력 차이 5.0 (상한 4.4)']);
}

// 8) 관리선이 좁은 변수(σ < 1)는 소수 둘째 자리 — 형체력 86 은 LCL 86.02 밖 (반올림해 86.0 ~ 으로 보이지 않게)
{
  const lim2 = { ...limits, variables: { mechanical_strength: L(87.17, 0.38, 1.41) } };
  const c = buildAlertCards([shot(1, { mechanical_strength: 87 }), shot(2, { mechanical_strength: 86 })], lim2, '2026-11-20', LABELS);
  assert.deepEqual(c[0].details, ['형체력 86.00 (관리선 86.03 ~ 88.31)']);
}

console.log('alerts.check OK');
