import type { FeatureKey, ModelInfo, Shot } from './types';

export const LABELS: Record<FeatureKey, string> = {
  injection_pressure: '주입 압력', sleeve_temperature: '슬리브 온도',
  top_temp1: '상금형온도 1', top_temp2: '상금형온도 2', top_temp3: '상금형온도 3',
  bottom_temp1: '하금형온도 1', bottom_temp2: '하금형온도 2', bottom_temp3: '하금형온도 3',
  cooling_water_temp: '냉각수 온도', biscuit_thickness: '비스켓 두께', mechanical_strength: '형체력',
  mold_temperature: '용융온도', molten_capacity: '용탕량',
  facility_CycleTime: '설비 사이클 시간', production_CycleTime: '생산 사이클 시간',
};

export type Severity = 'ok' | 'warn' | 'bad' | 'na';

export const fmt = (v: number | null | undefined) =>
  v == null ? '—' : Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1);
export const unitOf = (k: FeatureKey) =>
  /temp/i.test(k) ? '°C' : k === 'biscuit_thickness' ? 'mm' : /CycleTime/.test(k) ? 's' : '';

/** 정상 범위(p5~p95) 대비 상태. 범위 폭의 25% 넘게 벗어나면 '이탈' */
export function severity(model: ModelInfo, k: FeatureKey, v: number | null): Severity {
  if (v == null) return 'na';
  const [lo, , hi] = model.bands[k];
  if (v >= lo && v <= hi) return 'ok';
  return (v < lo ? lo - v : v - hi) / (hi - lo || 1) > 0.25 ? 'bad' : 'warn';
}

/**
 * 공정 변수 모니터 (4열×3행) — 사이클 진행 순서대로 공정 단계별 묶음
 * 형폐·주탕(1열) → 사출(2열) → 응고·냉각·취출(3~4열). 사이클 칸은 생산 사이클을 함께 표시
 */
export const MONITOR_GROUPS: { name: string; keys: FeatureKey[] }[] = [
  { name: '형폐 · 주탕', keys: ['mechanical_strength', 'mold_temperature', 'molten_capacity'] },
  { name: '사출', keys: ['sleeve_temperature', 'injection_pressure', 'biscuit_thickness'] },
  { name: '응고 · 냉각 · 취출', keys: ['top_temp1', 'top_temp2', 'bottom_temp1', 'bottom_temp2', 'cooling_water_temp', 'facility_CycleTime'] },
];
export const MONITOR_KEYS: FeatureKey[] = MONITOR_GROUPS.flatMap(g => g.keys);

/** 정상 범위(p5~p95)를 벗어난 변수가 하나라도 있는 샷인지 (결측은 제외) */
export const isOutOfRange = (s: Shot, model: ModelInfo, keys: FeatureKey[]) =>
  keys.some(k => { const v = s.features[k]; return v != null && severity(model, k, v) !== 'ok'; });
// 알림(관리도 기준)은 alerts.ts — 이 파일의 severity 는 공정 변수 모니터·KPI 표시용 (정상 범위 p5~p95)

