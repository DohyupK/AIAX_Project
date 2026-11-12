import type { FeatureKey, ModelInfo, Shot } from './types';

export const STREAK_ALERT = 3;       // 연속 Fail 알림 기준

export const LABELS: Record<FeatureKey, string> = {
  injection_pressure: '사출 압력', sleeve_temperature: '슬리브 온도',
  top_temp1: '상형 온도1', top_temp2: '상형 온도2', top_temp3: '상형 온도3',
  bottom_temp1: '하형 온도1', bottom_temp2: '하형 온도2', bottom_temp3: '하형 온도3',
  cooling_water_temp: '냉각수 온도', biscuit_thickness: '비스킷 두께', mechanical_strength: '기계 강도',
  mold_temperature: '금형 온도', molten_capacity: '용탕량',
  facility_CycleTime: '설비 사이클', production_CycleTime: '생산 사이클',
};

// 조치 문구는 예시. 현장 담당자 검수 후 확정 필요
export const GUIDE: Partial<Record<FeatureKey, string>> = {
  injection_pressure: '사출 압력 저하: 어큐뮬레이터 충전압과 플런저 팁 마모를 점검하세요. 사출 압력 600 미만 샷은 과거 데이터에서 99.7%가 불량이었습니다.',
  sleeve_temperature: '슬리브 온도 이탈: 슬리브 예열 상태와 급탕 시간 편차를 확인하세요.',
  cooling_water_temp: '냉각수 온도 이탈: 냉각수 유량과 칠러 설정을 확인하세요.',
  top_temp1: '상형 온도 편차: 상형 냉각 채널 막힘과 히터 상태를 점검하세요.',
  top_temp2: '상형 온도 편차: 상형 냉각 채널 막힘과 히터 상태를 점검하세요.',
  bottom_temp1: '하형 온도 편차: 하형 냉각 채널과 이형제 도포량을 확인하세요.',
  bottom_temp2: '하형 온도 편차: 하형 냉각 채널과 이형제 도포량을 확인하세요.',
  biscuit_thickness: '비스킷 두께 이탈: 용탕 계량(래들) 정량을 확인하세요.',
};

export type Severity = 'ok' | 'warn' | 'bad' | 'na';

export const isFail = (s: Shot, th: number) => s.prob >= th;
export const fmt = (v: number | null | undefined) =>
  v == null ? '—' : Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1);
export const unitOf = (k: FeatureKey) => (/temp/i.test(k) ? '°C' : '');

/** 정상 범위(p5~p95) 대비 상태. 범위 폭의 25% 넘게 벗어나면 '이탈' */
export function severity(model: ModelInfo, k: FeatureKey, v: number | null): Severity {
  if (v == null) return 'na';
  const [lo, , hi] = model.bands[k];
  if (v >= lo && v <= hi) return 'ok';
  return (v < lo ? lo - v : v - hi) / (hi - lo || 1) > 0.25 ? 'bad' : 'warn';
}

/** 공정 변수 모니터 표 순서 (4×2): 1행 슬리브 온도·사출압력·상형1·상형2 / 2행 설비 사이클·냉각수·하형1·하형2 */
export const MONITOR_KEYS: FeatureKey[] = [
  'sleeve_temperature', 'injection_pressure', 'top_temp1', 'top_temp2',
  'facility_CycleTime', 'cooling_water_temp', 'bottom_temp1', 'bottom_temp2',
];

/** 정상 범위(p5~p95)를 벗어난 변수가 하나라도 있는 샷인지 (결측은 제외) */
export const isOutOfRange = (s: Shot, model: ModelInfo, keys: FeatureKey[]) =>
  keys.some(k => { const v = s.features[k]; return v != null && severity(model, k, v) !== 'ok'; });

/** keys = 알람과 관련된 변수 (팝업 조치 가이드 표시용) */
export interface AlertItem { time: string; shotId: number; critical: boolean; message: string; keys: FeatureKey[] }

export function buildAlerts(shots: Shot[], th: number, model: ModelInfo, keys: FeatureKey[]): AlertItem[] {
  const out: AlertItem[] = [];
  let streak = 0, prevKey = '';
  for (const s of shots) {
    const fail = isFail(s, th);
    const ip = s.features.injection_pressure;
    if (fail) {
      streak++;
      if (ip != null && ip < 600)
        out.push({ time: s.time, shotId: s.shotId, critical: true, message: `#${s.shotId} 사출 압력 ${Math.round(ip)} 급감 (정상 640 이상)`, keys: ['injection_pressure'] });
      if (streak === STREAK_ALERT)
        out.push({ time: s.time, shotId: s.shotId, critical: true, message: `연속 Fail ${STREAK_ALERT}샷 발생, 라인 점검 필요`, keys: [] });
    } else streak = 0;
    const off = keys.filter(k => k !== 'injection_pressure' && severity(model, k, s.features[k]) === 'bad');
    const key = off.join();
    if (fail && off.length && key !== prevKey) // 같은 변수 이탈이 연속되면 한 번만
      out.push({ time: s.time, shotId: s.shotId, critical: false, message: `#${s.shotId} ${off.map(k => LABELS[k]).join(', ')} 정상 범위 이탈`, keys: off });
    prevKey = fail ? key : '';
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

/** 온도 변수 여부 — 온도는 샷 간 자기상관이 커서 I-MR 대신 EWMA 관리도 사용 */
export const isThermal = (k: FeatureKey) => /temp/i.test(k);

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
