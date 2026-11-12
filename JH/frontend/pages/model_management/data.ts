// Model Management 목업 데이터 — 모델 레지스트리 API 연동 전 자리 (연동 시 이 파일만 API 호출로 교체)

export type Process = "optimization" | "quality" | "safety";

/** 관리 공정: 화면 표시명 + 공정 코드 */
export const PROCESS: Record<Process, { label: string; code: string }> = {
  optimization: { label: "공정 최적화", code: "CAST-OPT" },
  quality: { label: "품질 검사", code: "CAST-QC" },
  safety: { label: "안전 관리", code: "SAFE-GATE" },
};

export interface Metrics {
  accuracy: number;  // 0~1
  recall: number;
  precision: number;
  f1: number;
}

export interface Model {
  id: number;
  name: string;
  version: string;
  createdAt: string;   // 'YYYY-MM-DD'
  process: Process;
  description: string;
  metrics: Metrics;
  applyCount: number;  // 현장 적용(배포) 횟수
  deployed: boolean;
  fileName?: string;   // 업로드한 모델 파일명 (실제 파일은 서버 연동 후 저장)
}

export const MODELS: Model[] = [
  { id: 1, name: "casting-defect-xgb", version: "v1.0", createdAt: "2026-08-12", process: "optimization", description: "주조 샷별 불량 확률 예측 (온도·압력 센서 기반)", metrics: { accuracy: 0.901, recall: 0.842, precision: 0.815, f1: 0.828 }, applyCount: 2, deployed: false },
  { id: 2, name: "casting-defect-xgb", version: "v1.2", createdAt: "2026-10-02", process: "optimization", description: "v1.0 대비 금형 온도 변수 추가, 임계값 재조정", metrics: { accuracy: 0.927, recall: 0.881, precision: 0.856, f1: 0.868 }, applyCount: 5, deployed: true },
  { id: 3, name: "casting-defect-lgbm", version: "v0.9", createdAt: "2026-10-28", process: "optimization", description: "LightGBM 비교 실험 모델", metrics: { accuracy: 0.919, recall: 0.873, precision: 0.84, f1: 0.856 }, applyCount: 0, deployed: false },
  { id: 4, name: "surface-inspect-cnn", version: "v2.2", createdAt: "2026-09-15", process: "quality", description: "외관 검사 이미지 기공·크랙 분류", metrics: { accuracy: 0.948, recall: 0.902, precision: 0.911, f1: 0.906 }, applyCount: 3, deployed: false },
  { id: 5, name: "surface-inspect-cnn", version: "v2.3", createdAt: "2026-11-02", process: "quality", description: "기공 불량 검출률 개선, 오검출 감소", metrics: { accuracy: 0.962, recall: 0.931, precision: 0.924, f1: 0.927 }, applyCount: 1, deployed: true },
  { id: 6, name: "ppe-detector-yolo", version: "v1.1", createdAt: "2026-09-30", process: "safety", description: "게이트 검색대 안전장구 5종 검출", metrics: { accuracy: 0.935, recall: 0.912, precision: 0.897, f1: 0.904 }, applyCount: 4, deployed: true },
  { id: 7, name: "ppe-detector-yolo", version: "v1.2-rc", createdAt: "2026-11-05", process: "safety", description: "보안경 검출 데이터 보강 후보 모델", metrics: { accuracy: 0.941, recall: 0.925, precision: 0.889, f1: 0.907 }, applyCount: 0, deployed: false },
];
