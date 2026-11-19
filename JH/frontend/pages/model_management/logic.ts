// Model Management 순수 로직 (화면·CSS import 없음) — 자체 점검: logic.check.ts
// 타입만 import (런타임 import 없음 → node 단독 실행 점검 가능). 공정·지표 표는 인자로 받음
import type { MetricKey, Model, Process, RobustnessRow } from "./data";

type ProcessTable = Record<Process, { label: string }>;

export type SortKey = "id" | "name" | "process" | "createdAt" | "version";

/** 정렬 후 배포 모델을 맨 위로 고정 (배포/미배포 각각 정렬 순서 유지) */
export function sortModels(list: Model[], key: SortKey, asc: boolean, processes: ProcessTable): Model[] {
  const value = (m: Model) => (key === "process" ? processes[m.process].label : m[key]);
  const sorted = [...list].sort((a, b) => {
    const c = String(value(a)).localeCompare(String(value(b)), "ko", { numeric: true });
    return asc ? c : -c;
  });
  return [...sorted.filter((m) => m.deployed), ...sorted.filter((m) => !m.deployed)];
}

export type Draft = Record<"name" | "version" | "process" | "description" | MetricKey, string>;
export type Errors = Partial<Record<keyof Draft | "file", string>>;

/** DieCasting 명명: 알고리즘 토큰 (등록 폼에서 입력하는 부분) */
export const ALGO_NAME_RE = /^[A-Za-z][A-Za-z0-9]*$/;

/** 등록 입력값 검사 — 고른 공정의 지표 4개만 검사. 오류가 없으면 빈 객체 */
export function validateDraft(d: Draft, processes: ProcessTable, metricsOf: Record<Process, MetricKey[]>): Errors {
  const e: Errors = {};
  // name = DieCasting_ 뒤에 붙는 알고리즘 (예: XGB, LGBM)
  if (!d.name.trim()) e.name = "알고리즘을 입력하세요 (예: XGB)";
  else if (!ALGO_NAME_RE.test(d.name.trim())) e.name = "영문·숫자만 가능 (예: XGB, CatB)";
  if (!d.version.trim()) e.version = "버전을 입력하세요";
  if (!Object.hasOwn(processes, d.process)) {
    e.process = "관리공정을 선택하세요";
    return e;
  }
  for (const key of metricsOf[d.process as Process]) {
    const n = Number(d[key]);
    if (d[key].trim() === "" || !Number.isFinite(n) || n < 0 || n > 1) e[key] = "0~1 사이 숫자";
  }
  return e;
}

/** 강건성 조건 표시 순서 (DB 에 순서 칼럼 없음). 목록에 없는 조건은 뒤에 DB 순서대로 */
export const ROBUSTNESS_ORDER = [
  "어두운 조명", "밝은 조명", "대비 감소", "대비 증가", "반사광", "약한 흐림", "강한 흐림",
  "흔들림", "약한 노이즈", "강한 노이즈", "강한 압축", "45° 회전", "위치 이동", "0.85배 축소",
];

export function orderRobustness(rows: RobustnessRow[]): RobustnessRow[] {
  const rank = (r: RobustnessRow) => {
    const i = ROBUSTNESS_ORDER.indexOf(r.condition);
    return i < 0 ? ROBUSTNESS_ORDER.length : i;
  };
  return [...rows].sort((a, b) => rank(a) - rank(b)); // 안정 정렬 → 미등록 조건은 받은 순서 유지
}

/** 조건 평균 — 손상 조건 값의 단순 평균 (원본은 인자에 없음). 행이 없으면 null */
export function averageRobustness(rows: RobustnessRow[]): Omit<RobustnessRow, "condition"> | null {
  if (rows.length === 0) return null;
  const avg = (k: "accuracy" | "recall" | "precision" | "f1") => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  return { accuracy: avg("accuracy"), recall: avg("recall"), precision: avg("precision"), f1: avg("f1") };
}
