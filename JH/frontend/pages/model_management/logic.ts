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

export type Draft = Record<"name" | "version" | "process" | "description" | keyof Metrics, string>;
export type Errors = Partial<Record<keyof Draft | "file", string>>;

/**
 * 생성일 = 등록 시점의 로컬 날짜 YYYY-MM-DD (sv-SE 로캘이 ISO 형식)
 * ponytail: DB 미연동이라 화면에서 생성. 레지스트리 DB 연동 시 서버 created_at(DEFAULT CURRENT_TIMESTAMP) 응답값으로 교체
 */
export const createdAtNow = (d = new Date()) => d.toLocaleDateString("sv-SE");

/** 등록 입력값 검사 — 오류가 없으면 빈 객체 */
export function validateDraft(d: Draft, processes: ProcessTable): Errors {
  const e: Errors = {};
  // name = 공정 앞부분 뒤에 붙는 모델 종류 (예: xgb, lgbm)
  if (!d.name.trim()) e.name = "모델 종류를 입력하세요 (예: xgb)";
  else if (!/^[a-z0-9][a-z0-9_-]*$/.test(d.name.trim())) e.name = "영문 소문자·숫자·-·_ 만 가능";
  if (!d.version.trim()) e.version = "버전을 입력하세요";
  if (!Object.hasOwn(processes, d.process)) e.process = "관리공정을 선택하세요";
  for (const key of METRIC_KEYS) {
    const n = Number(d[key]);
    if (d[key].trim() === "" || !Number.isFinite(n) || n < 0 || n > 1) e[key] = "0~1 사이 숫자";
  }
  return e;
}
