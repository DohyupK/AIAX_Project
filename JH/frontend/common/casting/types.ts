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
  shotId: number;          // production_count — 하루 안에서 중복될 수 있음 (카운터 재시작). 화면 키로 쓰지 말 것
  castingId?: string;      // 샷 고유키 'L<라인번호>_YYMMDD_HHMMSS_생산번호' (예: L2_261101_000336_1) (실데이터 API 만, 목업엔 없음)
  time: string;            // 'H:mm:ss'
  prob: number;            // 1차(ML) 불량 점수 0~1 (모델 출력, 실제 확률보다 높게 나옴 — 확률 %로 표시 금지)
  actual: 0 | 1 | null;    // 실제 라벨(PassOrFail). 아직 모르면 null
  features: Features;
  /** 선택: 변수별 SHAP 기여도. 있으면 '주요 원인'에 그대로 사용 */
  contributions?: Partial<Record<FeatureKey, number>>;
}

/** 1차(ML) 검사 모델 — JH API /api/casting/model (Model Management 「품질 1차 검사」 배포 모델, 없으면 기본 모델) */
export interface MlModel {
  name: string;
  version: string;        // 기본 모델이면 ''
  source: 'registry' | 'default'; // registry = DB 배포 모델 / default = 레지스트리 등록 전 기본 모델
  threshold: number;      // 점수 ≥ threshold 면 1차 불량
  trainedOn: string;      // 학습 데이터 설명
  features: string[];     // 입력 순서
  test: { Recall?: number; Precision?: number; F1?: number }; // TM 검증 성적
}

/** 2차(DL) 판정 1건 — 칼럼은 DB ai.quality_prediction 과 같음 (지금은 저장 없이 API 응답만) */
export interface SecondResult {
  castingId: string;
  modelName: string;
  version: string;          // 기본 모델이면 ''
  result: 'pass' | 'fail';
  confidenceScore: number;  // 불량 확률 0~1 (TM: 0.5 이상 불량)
  predictedAt: string;      // ISO 시각
}

/** 2차(DL) 검사 — JH API /api/casting/second (이미지 mes.casting_image 가 있는 샷만) */
export interface SecondCheck {
  model: { name: string; version: string; source: 'registry' | 'default'; threshold: number };
  results: SecondResult[];
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

