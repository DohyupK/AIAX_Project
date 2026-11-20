import type { FeatureKey, ModelInfo, SecondResult, Shot } from '../../common/casting/types';

/** 1차(ML) 판정 — 점수 ≥ 기준값이면 불량 */
export const firstFail = (s: Shot, th: number) => s.prob >= th;

/**
 * 2차(DL) 상태 — 2차는 1차 양품 샷만 대상 (ML 이 놓친 불량을 이미지로 재검)
 * first = 1차 불량 확정(대상 아님) / noImage = 대상이지만 샷 이미지 없음 / pending = 사진 있음·서버 판정 전 / 그 외 = DL 판정 결과
 */
export type SecondState = 'first' | 'noImage' | 'pending' | SecondResult;
/** castingId → 2차 결과, 또는 'pending'(사진은 있는데 아직 판정 전) */
export type SecondMap = ReadonlyMap<string, SecondResult | 'pending'>;

export function secondOf(s: Shot, th: number, results: SecondMap): SecondState {
  if (firstFail(s, th)) return 'first';
  return (s.castingId && results.get(s.castingId)) || 'noImage';
}

/** 최종 불량 = 1차 불량 + 2차 불량. 2차 불량률 분모 = 판정이 끝난 샷(이미지 있는 1차 양품). pending = 판정 대기 */
export interface InspectionSummary {
  total: number; first: number; secondTargets: number; inspected: number; pending: number; second: number; final: number;
}

export function summarize(shots: Shot[], th: number, results: SecondMap): InspectionSummary {
  let first = 0, inspected = 0, pending = 0, second = 0;
  for (const s of shots) {
    const st = secondOf(s, th, results);
    if (st === 'first') first++;
    else if (st === 'pending') pending++;
    else if (st !== 'noImage') {
      inspected++;
      if (st.result === 'fail') second++;
    }
  }
  return { total: shots.length, first, secondTargets: shots.length - first, inspected, pending, second, final: first + second };
}

/** 분모 0이면 null */
export const rate = (n: number, d: number) => (d ? (n / d) * 100 : null);

/**
 * 1차(ML) 판정 vs 실제 판정 비교 — 맞힌 불량(tp) / 잘못 경보(fp) / 놓친 불량(fn) / 정상(tn)
 * 실제 판정이 없는 샷(actual null)은 비교에서 빼고 unjudged 로 셈. recall·precision 은 분모 0이면 null
 */
export function confusion(shots: Shot[], th: number) {
  let tp = 0, fp = 0, fn = 0, tn = 0, unjudged = 0;
  for (const s of shots) {
    if (s.actual == null) { unjudged++; continue; }
    const p = firstFail(s, th);
    if (p && s.actual === 1) tp++;
    else if (p) fp++;
    else if (s.actual === 1) fn++;
    else tn++;
  }
  return {
    tp, fp, fn, tn, unjudged,
    recall: tp + fn ? tp / (tp + fn) : null,      // 실제 불량 중 1차가 잡은 비율
    precision: tp + fp ? tp / (tp + fp) : null,   // 1차 경보 중 실제 불량 비율
  };
}

/** 정상 중앙값(p50) 대비 벗어난 정도 — 정상 범위 반폭 단위. 상위 n개 (결측 제외) */
export function topDeviations(s: Shot, model: ModelInfo, n = 5): { key: FeatureKey; value: number; score: number }[] {
  return (Object.keys(model.bands) as FeatureKey[])
    .flatMap(key => {
      const value = s.features[key];
      if (value == null) return [];
      const [lo, mid, hi] = model.bands[key];
      return [{ key, value, score: Math.abs(value - mid) / ((hi - lo) / 2 || 1) }];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
