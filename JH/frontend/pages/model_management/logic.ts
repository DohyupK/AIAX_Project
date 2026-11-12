// Model Management 순수 로직 (화면·CSS import 없음) — 자체 점검: logic.check.ts
// 타입만 import (런타임 import 없음 → node 단독 실행 점검 가능). 공정 표는 인자로 받음
import type { Metrics, Model, Process } from "./data";

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

export const METRIC_KEYS: (keyof Metrics)[] = ["accuracy", "recall", "precision", "f1"];

export type Draft = Record<"name" | "version" | "createdAt" | "process" | "description" | keyof Metrics, string>;
export type Errors = Partial<Record<keyof Draft | "file", string>>;

/** 등록 입력값 검사 — 오류가 없으면 빈 객체 */
export function validateDraft(d: Draft, processes: ProcessTable): Errors {
  const e: Errors = {};
  if (!d.name.trim()) e.name = "모델명을 입력하세요";
  if (!d.version.trim()) e.version = "버전을 입력하세요";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.createdAt)) e.createdAt = "생성일을 선택하세요";
  if (!Object.hasOwn(processes, d.process)) e.process = "관리공정을 선택하세요";
  for (const key of METRIC_KEYS) {
    const n = Number(d[key]);
    if (d[key].trim() === "" || !Number.isFinite(n) || n < 0 || n > 1) e[key] = "0~1 사이 숫자";
  }
  return e;
}
