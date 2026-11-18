import type { FeatureKey, ModelInfo, Shot } from '../../common/casting/types';

/**
 * 1차(ML)·2차(DL) 검사 판정
 * ponytail: DL 모델 미완성 — 2차 판정은 목업의 실제 라벨(actual)로 대신함. DL 연결 시 secondFail 만 교체
 */
export const firstFail = (s: Shot, th: number) => s.prob >= th;
/**
 * 2차(DL) 모델 연결 여부 — false 면 품질 검사 화면은 2차 칸을 「연결 전」으로 두고 secondFail 을 쓰지 않음
 * (secondFail 은 실제 라벨로 흉내 낸 목업이라 화면에 DL 결과처럼 보이면 안 됨). DL 연결 시 true + secondFail 교체
 */
export const DL_CONNECTED = false;
/** 2차 검사는 1차 패스(양품) 샷만 대상 — ML 이 놓친 불량을 DL 이 재검. 1차 불량이면 null(이미 불량 확정) */
export const secondFail = (s: Shot, th: number): boolean | null => (firstFail(s, th) ? null : s.actual === 1);

/** 최종 불량 = 1차 불량 + 2차 불량 */
export interface InspectionSummary { total: number; first: number; second: number; secondTargets: number; final: number }

export function summarize(shots: Shot[], th: number): InspectionSummary {
  let first = 0, second = 0;
  for (const s of shots) {
    if (firstFail(s, th)) first++;
    else if (secondFail(s, th)) second++;
  }
  return { total: shots.length, first, second, secondTargets: shots.length - first, final: first + second };
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
