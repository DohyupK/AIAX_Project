// 활성(배포) 모델 id — Model Management ↔ 공정/품질 대시보드 공유
// ponytail: localStorage 목업. MS 모델 레지스트리 DB 연동 시 서버 응답으로 교체
import type { ModelInfo } from './types';

export const ACTIVE_MODEL_STORAGE_KEY = 'jh.casting.activeModelId';

/** 레지스트리 행에서 대시보드에 필요한 최소 필드 */
export type ActiveModelRef = {
  id: number;
  name: string;
  version: string;
  metrics: { f1: number };
};

/** 브라우저 localStorage에서 활성 id 읽기 (없거나 무효면 fallback) */
export function getActiveModelId(fallback: number): number {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  const raw = window.localStorage.getItem(ACTIVE_MODEL_STORAGE_KEY);
  if (raw == null || raw === '') return fallback;
  const id = Number(raw);
  return Number.isFinite(id) ? id : fallback;
}

export function setActiveModelId(id: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, String(id));
}

/**
 * 레지스트리 모델 + model.json(밴드·임계값·중요도) → 대시보드 ModelInfo
 * name/version/auc 만 배포 모델을 따르고, bands 등은 목업 유지 (추론 API 전)
 */
export function toModelInfo(m: ActiveModelRef, base: ModelInfo): ModelInfo {
  return {
    ...base,
    name: m.name,
    version: m.version,
    auc: m.metrics.f1,
  };
}
