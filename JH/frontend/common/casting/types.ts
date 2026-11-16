// 백엔드 API 응답 형식. 실제 DB 연결 시 이 타입에 맞춰 응답을 주면 화면은 수정 없이 동작합니다.

export const FEATURES = [
  'injection_pressure', 'sleeve_temperature',
  'top_temp1', 'top_temp2', 'top_temp3',
  'bottom_temp1', 'bottom_temp2', 'bottom_temp3',
  'cooling_water_temp', 'biscuit_thickness', 'mechanical_strength',
  'mold_temperature', 'molten_capacity', 'facility_CycleTime', 'production_CycleTime',
] as const;
// top_temp4 / bottom_temp4 는 전 구간 상수(1620/1880)라 제외

export type FeatureKey = (typeof FEATURES)[number];
export type Features = Record<FeatureKey, number | null>; // null = 결측 (molten_capacity 약 22%)

/** 샷 1건의 예측 결과 */
export interface Shot {
  shotId: number;          // production_count
  time: string;            // 'H:mm:ss'
  prob: number;            // 불량 확률 0~1 (모델 출력)
  actual: 0 | 1 | null;    // 실제 라벨(PassOrFail). 아직 모르면 null
  features: Features;
  /** 선택: 변수별 SHAP 기여도. 있으면 '주요 원인'에 그대로 사용 */
  contributions?: Partial<Record<FeatureKey, number>>;
}

/** 현재 배포된 모델 정보 (Model Management와 공유) */
export interface ModelInfo {
  name: string;
  version: string;
  auc: number;
  threshold: number;                                     // 기본 판정 임계값
  importance: Record<FeatureKey, number>;                // 변수 영향도
  bands: Record<FeatureKey, [number, number, number]>;   // 정상 샷 [p5, p50, p95]
}

