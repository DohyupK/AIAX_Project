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

/** DieCasting 명명: 알고리즘 토큰 (등록 폼에서 입력하는 부분) */
export const ALGO_NAME_RE = /^[A-Za-z][A-Za-z0-9]*$/;

/** 등록 입력값 검사 — 오류가 없으면 빈 객체 */
export function validateDraft(d: Draft, processes: ProcessTable): Errors {
  const e: Errors = {};
  // name = DieCasting_ 뒤에 붙는 알고리즘 (예: XGB, LGBM)
  if (!d.name.trim()) e.name = "알고리즘을 입력하세요 (예: XGB)";
  else if (!ALGO_NAME_RE.test(d.name.trim())) e.name = "영문·숫자만 가능 (예: XGB, CatB)";
  if (!d.version.trim()) e.version = "버전을 입력하세요";
  if (!Object.hasOwn(processes, d.process)) e.process = "관리공정을 선택하세요";
  for (const key of METRIC_KEYS) {
    const n = Number(d[key]);
    if (d[key].trim() === "" || !Number.isFinite(n) || n < 0 || n > 1) e[key] = "0~1 사이 숫자";
  }
  return e;
}

/** 등록 시 최종 모델명 = DieCasting_{Algo}_{YYYYMMDD}_{임시순번01} */
export function buildModelName(prefix: string, algo: string, createdAt: string): string {
  const ymd = createdAt.replaceAll("-", "");
  return `${prefix}_${algo.trim()}_${ymd}_01`;
}

/**
 * 배포 전환: 같은 공정에서 id 하나만 deployed.
 * 이미 배포 중이면 목록 그대로 반환.
 */
export function applyDeploy(list: Model[], id: number): Model[] {
  const target = list.find((m) => m.id === id);
  if (!target) return list;
  if (target.deployed) return list;
  return list.map((m) => {
    if (m.id === id) return { ...m, deployed: true, applyCount: m.applyCount + 1 };
    if (m.process === target.process && m.deployed) return { ...m, deployed: false };
    return m;
  });
}

/** localStorage 활성 id에 맞춰 deployed 플래그 동기화 (공정 무관 전역 1개) */
export function syncDeployedFlags(list: Model[], activeId: number): Model[] {
  if (!list.some((m) => m.id === activeId)) return list;
  return list.map((m) => ({ ...m, deployed: m.id === activeId }));
}
