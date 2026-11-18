// Model Management 순수 로직 (화면·CSS import 없음) — 자체 점검: logic.check.ts
// 타입만 import (런타임 import 없음 → node 단독 실행 점검 가능). 공정·지표 표는 인자로 받음
import type { MetricKey, Model, Process } from "./data";

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
