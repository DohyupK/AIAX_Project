// Model Management — 공정·성과지표 정의 + 레지스트리 조회 (화면·CSS import 없음)
// 데이터: 서버 DB ai.model_registry + 공정별 지표 테이블 (JH API GET /api/models, 읽기 전용)
// 각 공정의 배포 모델 = 그 화면이 실제로 쓰는 모델 (품질 1차 = 품질 검사 1차 판정에 사용)

/** 화면 공정 키 ↔ DB process_code (CAST-QC1 / CAST-QC2 / SAFE-PPE) */
export type Process = "qc1" | "qc2" | "ppe";

/** 관리 공정: 화면 표시명 + DB 공정 코드 + 모델명 앞부분(등록된 모델 이름 기준) + 알고리즘 예시 + 배포 모델을 쓰는 화면 */
export const PROCESS: Record<Process, { label: string; code: string; prefix: string; algoHint: string; usedBy: string }> = {
  qc1: { label: "품질 1차 검사", code: "CAST-QC1", prefix: "DieCasting", algoHint: "XGB, LGBM, CatB …", usedBy: "품질 검사 대시보드 1차(ML) 판정" },
  qc2: { label: "품질 2차 검사", code: "CAST-QC2", prefix: "DieCasting", algoHint: "CNXV2T …", usedBy: "품질 검사 대시보드 2차(DL) 검사" },
  ppe: { label: "보호구 착용 위반", code: "SAFE-PPE", prefix: "PPE", algoHint: "YOLO26n, YOLO26s …", usedBy: "보호구 착용 위반 대시보드 판정" },
};
const BY_CODE = Object.fromEntries(Object.entries(PROCESS).map(([k, v]) => [v.code, k as Process]));

/** 성과지표 종류 — 공정마다 쓰는 4개가 다름 (DB 지표 테이블 칼럼과 같게) */
export type MetricKey = "accuracy" | "prAuc" | "map50" | "recall" | "precision" | "f1";
export const METRIC_LABEL: Record<MetricKey, string> = {
  accuracy: "Accuracy",
  prAuc: "PR-AUC",
  map50: "mAP50",
  recall: "Recall",
  precision: "Precision",
  f1: "F1-Score",
};
/** 공정별 지표 4개 (화면 카드·등록 폼 순서). 품질 1차 = ai.model_metric_cast_qc1, 2차 = _cast_qc2, 보호구(검출) = _safe_ppe */
export const PROCESS_METRICS: Record<Process, MetricKey[]> = {
  qc1: ["prAuc", "recall", "precision", "f1"],
  qc2: ["accuracy", "recall", "precision", "f1"],
  ppe: ["map50", "recall", "precision", "f1"],
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

async function get<T>(path: string): Promise<T> {
  // 10초 넘게 응답이 없으면 끊어 「불러오는 중」 고착 방지
  try {
    const res = await fetch(`${BASE}/api/models${path}`, {
      cache: "no-store", signal: AbortSignal.timeout(10_000),   // 권한 = 로그인 세션 쿠키 (서버 판단)
    });
    if (!res.ok) throw new Error(`/api/models${path} 요청 실패 (HTTP ${res.status})`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`/api/models${path} 요청 시간 초과 (10초) — 서버 DB(.env DATABASE_URL) 확인`);
    }
    throw e;
  }
}

/** Model Management 권한 — none: 접근 불가 / read: 보기 / edit: 보기 + 등록·배포 */
export type AccessLevel = "none" | "read" | "edit";
export async function fetchAccess(): Promise<AccessLevel> {
  return (await get<{ accessLevel: AccessLevel }>("/me")).accessLevel;
}

type ModelRow = Omit<Model, "process"> & { processCode: string };
/** 화면이 모르는 공정 코드 행은 뺌 */
const toModels = (rows: ModelRow[]): Model[] =>
  rows.flatMap(({ processCode, ...r }) => (BY_CODE[processCode] ? [{ ...r, process: BY_CODE[processCode] }] : []));

/** 전체 모델 목록 (DB, read 권한 필요) */
export async function fetchModels(): Promise<Model[]> {
  return toModels(await get<ModelRow[]>(""));
}

/** 강건성 1줄 — 손상 조건별 지표 (DB ai.model_robustness) */
export interface RobustnessRow {
  condition: string;
  accuracy: number;
  recall: number;
  precision: number;
  f1: number;
}

/** 모델 1개의 조건별 강건성 (품질 2차 「강건성」 팝업). 데이터가 없으면 빈 배열 */
export async function fetchRobustness(modelId: number): Promise<RobustnessRow[]> {
  return get<RobustnessRow[]>(`/${modelId}/robustness`);
}

/** 공정의 배포 모델 (없으면 null) — 보호구 화면 표시용, 계정 불필요 */
export async function fetchDeployedModel(p: Process): Promise<Model | null> {
  return toModels(await get<ModelRow[]>("/deployed")).find((m) => m.process === p) ?? null;
}
