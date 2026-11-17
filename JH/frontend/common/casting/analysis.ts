import type { FeatureKey, ModelInfo, Shot } from './types';

export const LABELS: Record<FeatureKey, string> = {
  injection_pressure: '주입 압력', sleeve_temperature: '슬리브 온도',
  top_temp1: '상금형온도 1', top_temp2: '상금형온도 2', top_temp3: '상금형온도 3',
  bottom_temp1: '하금형온도 1', bottom_temp2: '하금형온도 2', bottom_temp3: '하금형온도 3',
  cooling_water_temp: '냉각수 온도', biscuit_thickness: '비스켓 두께', mechanical_strength: '형체력',
  mold_temperature: '용융온도', molten_capacity: '용탕량',
  facility_CycleTime: '설비 사이클 시간', production_CycleTime: '생산 사이클 시간',
};

// 조치 문구는 예시. 현장 담당자 검수 후 확정 필요
export const GUIDE: Partial<Record<FeatureKey, string>> = {
  injection_pressure: '주입 압력 저하: 어큐뮬레이터 충전압과 플런저 팁 마모를 점검하세요. 주입 압력 600 미만 샷은 과거 데이터에서 99.7%가 불량이었습니다.',
  sleeve_temperature: '슬리브 온도 이탈: 슬리브 예열 상태와 급탕 시간 편차를 확인하세요.',
  cooling_water_temp: '냉각수 온도 이탈: 냉각수 유량과 칠러 설정을 확인하세요.',
  top_temp1: '상금형온도 편차: 상금형 냉각 채널 막힘과 히터 상태를 점검하세요.',
  top_temp2: '상금형온도 편차: 상금형 냉각 채널 막힘과 히터 상태를 점검하세요.',
  bottom_temp1: '하금형온도 편차: 하금형 냉각 채널과 이형제 도포량을 확인하세요.',
  bottom_temp2: '하금형온도 편차: 하금형 냉각 채널과 이형제 도포량을 확인하세요.',
  biscuit_thickness: '비스켓 두께 이탈: 용탕 계량(래들) 정량을 확인하세요.',
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

/** keys = 알람과 관련된 변수 (팝업 조치 가이드 표시용) */
export interface AlertItem { time: string; shotId: number; critical: boolean; message: string; keys: FeatureKey[] }

/**
 * 알람 = 공정 변수 모니터 판정과 같은 기준 (severity). 변수가 정상 → 주의/이탈로 나빠지는 순간 1번 울림
 * (같은 상태가 계속되면 다시 울리지 않음 — 정상으로 돌아왔다가 다시 벗어나면 다시 울림)
 * 이탈 = 위험(빨강), 주의 = 주의(주황). 한 샷에서 여러 변수가 걸리면 등급별로 묶어서 1건
 */
export function buildAlerts(shots: Shot[], model: ModelInfo, keys: FeatureKey[]): AlertItem[] {
  const out: AlertItem[] = [];
  const rank = { ok: 0, na: 0, warn: 1, bad: 2 } as const;
  const prev: Partial<Record<FeatureKey, number>> = {};
  const range = (k: FeatureKey) => `${fmt(model.bands[k][0])}~${fmt(model.bands[k][2])}`;
  for (const s of shots) {
    const hit: Record<1 | 2, FeatureKey[]> = { 1: [], 2: [] };
    for (const k of keys) {
      const v = s.features[k];
      if (v == null) continue; // 결측은 상태 유지 (알람·해제 모두 안 함)
      const r = rank[severity(model, k, v)];
      if (r > (prev[k] ?? 0)) hit[r as 1 | 2].push(k);
      prev[k] = r;
    }
    for (const r of [1, 2] as const) { // 최근 순으로 뒤집으므로 같은 샷이면 이탈이 위
      if (!hit[r].length) continue;
      const what = hit[r].map(k => `${LABELS[k]} ${fmt(s.features[k])}${unitOf(k)} (정상 ${range(k)})`).join(", ");
      out.push({ time: s.time, shotId: s.shotId, critical: r === 2, message: `#${s.shotId} ${r === 2 ? "이탈" : "주의"}: ${what}`, keys: hit[r] });
    }
  }
  return out.reverse();
}

/** 관리도(SPC) 기준 구간: 그날 처음 이 샷 수로 관리 한계를 계산해 고정 (AIAG Phase I) */
export const SPC_BASELINE = 100;
// ponytail: 실제 API 연결 후에는 과거 정상 기간 데이터를 기준 구간으로 쓰는 것이 정석

export interface SpcLimits { cl: number; ucl: number; lcl: number; n: number }

function imr(v: number[]): SpcLimits | null {
  if (v.length < 2) return null;
  const cl = v.reduce((a, b) => a + b, 0) / v.length;
  let mr = 0;
  for (let i = 1; i < v.length; i++) mr += Math.abs(v[i] - v[i - 1]);
  mr /= v.length - 1;
  return { cl, ucl: cl + 2.66 * mr, lcl: cl - 2.66 * mr, n: v.length }; // 2.66 = 3 / d2(1.128)
}

/** 개별값 관리도(I-MR) 한계: CL = 평균, UCL/LCL = CL ± 2.66·MR̄. 기준 구간에서 한계 밖 점을 빼고 1회 재계산 */
export function spcLimits(baseline: number[]): SpcLimits | null {
  const first = imr(baseline);
  if (!first) return null;
  return imr(baseline.filter(v => v >= first.lcl && v <= first.ucl)) ?? first;
}

// EWMA 표준 파라미터 (λ 0.05~0.25, L≈3 권장 범위)
export const EWMA_LAMBDA = 0.2;
export const EWMA_L = 3;

function ewmaCalc(v: number[]): SpcLimits | null {
  if (v.length < 2) return null;
  const cl = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - cl) ** 2, 0) / (v.length - 1)); // 전체 표본표준편차
  const w = EWMA_L * sd * Math.sqrt(EWMA_LAMBDA / (2 - EWMA_LAMBDA));
  return { cl, ucl: cl + w, lcl: cl - w, n: v.length };
}

/**
 * EWMA 관리 한계: CL = 평균, UCL/LCL = CL ± L·σ·√(λ/(2-λ)), σ = 기준 구간 전체 표준편차.
 * 기준 구간에서 평균 ± 3σ 밖 샷을 빼고 1회 재계산
 */
// ponytail: 정상 상태(점근) 한계만 사용 — 하루 첫 몇 샷은 실제 한계보다 넓게 잡힘. 엄밀히 하려면 시점별 한계 (1-(1-λ)^2i) 항 추가
export function ewmaLimits(baseline: number[]): SpcLimits | null {
  const first = ewmaCalc(baseline);
  if (!first) return null;
  const sd3 = (first.ucl - first.cl) / Math.sqrt(EWMA_LAMBDA / (2 - EWMA_LAMBDA)); // = 3σ
  return ewmaCalc(baseline.filter(v => Math.abs(v - first.cl) <= sd3)) ?? first;
}

/** EWMA 통계량 z_i = λ·x_i + (1-λ)·z_(i-1), z_0 = CL */
export function ewmaSeries(v: number[], cl: number): number[] {
  let z = cl;
  return v.map(x => (z = EWMA_LAMBDA * x + (1 - EWMA_LAMBDA) * z));
}

export type NelsonRule = 1 | 2 | 3;
export const NELSON_TEXT: Record<NelsonRule, string> = {
  1: '규칙 1: 관리 한계 밖',
  2: '규칙 2: 9점 연속 중심선 한쪽',
  3: '규칙 3: 6점 연속 상승/하강',
};

/** Nelson 규칙 1·2·3 판정. 점마다 위반한 규칙 목록 (연속 규칙은 해당 구간의 모든 점에 표시) */
export function nelsonFlags(v: number[], lim: SpcLimits): NelsonRule[][] {
  const flags: NelsonRule[][] = v.map(x => (x > lim.ucl || x < lim.lcl ? [1] : []));
  // 연속 구간 [start, end] 가 len 이상이면 rule 표시
  const mark = (start: number, end: number, len: number, rule: NelsonRule) => {
    if (end - start + 1 >= len) for (let j = start; j <= end; j++) if (!flags[j].includes(rule)) flags[j].push(rule);
  };
  // 규칙 2: 중심선 한쪽 9점 연속 (중심선 위 점은 흐름 끊김)
  const side = v.map(x => Math.sign(x - lim.cl));
  for (let i = 0, s = 0; i <= v.length; i++) {
    if (i === v.length || side[i] === 0 || side[i] !== side[s]) {
      if (s < v.length && side[s] !== 0) mark(s, i - 1, 9, 2);
      s = i;
    }
  }
  // 규칙 3: 6점 연속 증가 또는 감소 (같은 값은 흐름 끊김)
  const dir = v.map((x, i) => (i ? Math.sign(x - v[i - 1]) : 0));
  for (let i = 1, s = 0; i <= v.length; i++) {
    if (i === v.length || dir[i] === 0 || (i > s + 1 && dir[i] !== dir[i - 1])) {
      mark(s, i - 1, 6, 3);
      s = dir[i] === 0 ? i : i - 1; // 방향 전환점은 새 구간의 시작점
    }
  }
  return flags;
}
