// Model Management — 공정·성과지표 정의 + 레지스트리 조회 (화면·CSS import 없음)
// 데이터: 서버 DB ai.model_registry + 공정별 지표 테이블 (JH API GET /api/models, 읽기 전용)
// 각 공정의 배포 모델 = 그 화면이 실제로 쓰는 모델 (품질 1차 = 품질 검사 1차 판정에 사용)

/** 화면 공정 키 ↔ DB process_code (CAST-QC1 / CAST-QC2 / SAFE-PPE) */
export type Process = "qc1" | "qc2" | "ppe";

/** 관리 공정: 화면 표시명 + DB 공정 코드 + 모델명 앞부분 + 배포 모델을 쓰는 화면 */
export const PROCESS: Record<Process, { label: string; code: string; prefix: string; usedBy: string }> = {
  qc1: { label: "품질 1차 검사", code: "CAST-QC1", prefix: "DieCasting", usedBy: "품질 검사 대시보드 1차(ML) 판정" },
  qc2: { label: "품질 2차 검사", code: "CAST-QC2", prefix: "DieCasting", usedBy: "품질 검사 대시보드 2차(DL) 검사" },
  ppe: { label: "보호구 착용 위반", code: "SAFE-PPE", prefix: "DieCasting", usedBy: "보호구 착용 위반 대시보드 판정" },
};
const BY_CODE = Object.fromEntries(Object.entries(PROCESS).map(([k, v]) => [v.code, k as Process]));

/** 성과지표 종류 — 공정마다 쓰는 4개가 다름 (DB 지표 테이블 칼럼과 같게) */
export type MetricKey = "accuracy" | "prAuc" | "recall" | "precision" | "f1";
export const METRIC_LABEL: Record<MetricKey, string> = {
  accuracy: "Accuracy",
  prAuc: "PR-AUC",
  recall: "Recall",
  precision: "Precision",
  f1: "F1-Score",
};
/** 공정별 지표 4개 (화면 카드·등록 폼 순서). 품질 1차 = ai.model_metric_cast_qc1, 2차 = _cast_qc2, 보호구 = _safe_ppe */
export const PROCESS_METRICS: Record<Process, MetricKey[]> = {
  qc1: ["prAuc", "recall", "precision", "f1"],
  qc2: ["accuracy", "recall", "precision", "f1"],
  ppe: ["accuracy", "recall", "precision", "f1"],
};

/** 0~1. DB 지표 행이 없으면 null */
export type Metrics = Partial<Record<MetricKey, number | null>>;

export interface Model {
  id: number;          // DB model_registry_idx
  name: string;
  version: string;
  createdAt: string;   // 'YYYY-MM-DD'
  process: Process;
  description: string;
  metrics: Metrics;
  deployed: boolean;
  fileName: string | null;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/** 전체 모델 목록 (DB). 화면이 모르는 공정 코드 행은 뺌 */
export async function fetchModels(): Promise<Model[]> {
  // 10초 넘게 응답이 없으면 끊어 「불러오는 중」 고착 방지
  const res = await fetch(`${BASE}/api/models`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`/api/models 요청 실패 (HTTP ${res.status})`);
  const rows = (await res.json()) as (Omit<Model, "process"> & { processCode: string })[];
  return rows.flatMap(({ processCode, ...r }) => (BY_CODE[processCode] ? [{ ...r, process: BY_CODE[processCode] }] : []));
}

/** 공정의 배포 모델 (없으면 null) — 품질 검사·보호구 화면 표시용 */
export async function fetchDeployedModel(p: Process): Promise<Model | null> {
  return (await fetchModels()).find((m) => m.process === p && m.deployed) ?? null;
}
