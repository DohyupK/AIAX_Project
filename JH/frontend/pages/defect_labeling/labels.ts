// 불량 유형 라벨링 — 유형 정의·저장 규칙 (화면·CSS import 없음) — 자체 점검: labels.check.ts
// 저장 형태는 이후 DB 테이블과 같은 모양 (라벨 테이블 / 폐기 테이블). DB API 연결 시 loadStore·persistStore 만 API 호출로 교체

/** 불량 유형 — code 는 화면 표시·저장 값, ko 는 전문가용 보조 설명 */
export const DEFECT_TYPES = [
  { code: 'BLOWHOLE', ko: '기공' },
  { code: 'EDGE_BURR', ko: '버(Burr)·플래시(Flash) — 테두리에 남은 날카로운 살·찌꺼기' },
  { code: 'SURFACE_ROUGH', ko: '표면 결함 — 긁힘·요철·얼룩' },
  { code: 'UNDECIDABLE', ko: '판정 불가 (폐기 테이블로 이동)' },
] as const;
export type DefectCode = (typeof DEFECT_TYPES)[number]['code'];
export const UNDECIDABLE: DefectCode = 'UNDECIDABLE';
const CODES = DEFECT_TYPES.map(d => d.code) as readonly string[];

/** 라벨 테이블 행 (예정: defect_label) */
export interface LabelRecord { shot_id: number; line: string; defect_types: DefectCode[]; labeled_at: string }
/** 폐기 테이블 행 (예정: defect_discard) — 판정 불가 샷 */
export interface DiscardRecord { shot_id: number; line: string; reason: 'UNDECIDABLE'; discarded_at: string }
export interface LabelStore { labels: LabelRecord[]; discards: DiscardRecord[] }
export type LabelStatus = 'unlabeled' | 'labeled' | 'discarded';

export const emptyStore = (): LabelStore => ({ labels: [], discards: [] });

/**
 * 유형 선택 토글 — BLOWHOLE·EDGE_BURR·SURFACE_ROUGH 는 여러 개 선택 가능,
 * UNDECIDABLE 은 단독 (고르면 나머지 해제, 다른 유형을 고르면 UNDECIDABLE 해제)
 */
export function toggleType(selected: DefectCode[], code: DefectCode): DefectCode[] {
  if (selected.includes(code)) return selected.filter(c => c !== code);
  if (code === UNDECIDABLE) return [UNDECIDABLE];
  return [...selected.filter(c => c !== UNDECIDABLE), code];
}

const same = (line: string, shotId: number) => (r: { line: string; shot_id: number }) => r.line === line && r.shot_id === shotId;

/**
 * 라벨 저장 (완료 버튼). 같은 샷의 이전 기록은 두 테이블 모두에서 지우고 새로 기록 → 다시 라벨링해도 한 곳에만 존재
 * UNDECIDABLE → 폐기 테이블, 그 외 → 라벨 테이블. 선택이 비면 저장하지 않음
 */
export function saveLabel(store: LabelStore, line: string, shotId: number, types: DefectCode[], now: string): LabelStore {
  if (!types.length) throw new Error('불량 유형을 하나 이상 선택해야 합니다.');
  const keep = <T extends { line: string; shot_id: number }>(rows: T[]) => rows.filter(r => !same(line, shotId)(r));
  const base = { labels: keep(store.labels), discards: keep(store.discards) };
  if (types.includes(UNDECIDABLE)) {
    return { ...base, discards: [...base.discards, { shot_id: shotId, line, reason: 'UNDECIDABLE', discarded_at: now }] };
  }
  // 정의 순서로 정렬해 저장 (선택 순서와 무관하게 같은 값)
  const ordered = CODES.filter(c => types.includes(c as DefectCode)) as DefectCode[];
  return { ...base, labels: [...base.labels, { shot_id: shotId, line, defect_types: ordered, labeled_at: now }] };
}

export function statusOf(store: LabelStore, line: string, shotId: number): LabelStatus {
  if (store.discards.some(same(line, shotId))) return 'discarded';
  return store.labels.some(same(line, shotId)) ? 'labeled' : 'unlabeled';
}

/** 「전체」 목록 순서: 미라벨 → 라벨 완료 → 폐기. 같은 상태 안에서는 원래 순서(최신순) 유지 */
const STATUS_ORDER: Record<LabelStatus, number> = { unlabeled: 0, labeled: 1, discarded: 2 };
export function sortByStatus<T extends { shotId: number }>(items: T[], store: LabelStore, line: string): T[] {
  return [...items].sort((a, b) => STATUS_ORDER[statusOf(store, line, a.shotId)] - STATUS_ORDER[statusOf(store, line, b.shotId)]);
}

/** 저장된 유형 (폐기면 [UNDECIDABLE]) — 팝업을 다시 열 때 선택 복원용 */
export function typesOf(store: LabelStore, line: string, shotId: number): DefectCode[] {
  if (store.discards.some(same(line, shotId))) return [UNDECIDABLE];
  return store.labels.find(same(line, shotId))?.defect_types ?? [];
}

/** 저장소에서 읽은 값 검증 — 형식이 맞는 행만 사용 (손상·조작된 값 무시) */
export function parseStore(raw: unknown): LabelStore {
  const out = emptyStore();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<Record<keyof LabelStore, unknown>>;
  const ok = (x: unknown): x is { shot_id: number; line: string } =>
    !!x && typeof x === 'object' && Number.isInteger((x as { shot_id: unknown }).shot_id) && typeof (x as { line: unknown }).line === 'string';
  if (Array.isArray(r.labels)) {
    for (const x of r.labels) {
      const t = (x as LabelRecord)?.defect_types;
      if (ok(x) && Array.isArray(t) && t.length && t.every(c => CODES.includes(c) && c !== UNDECIDABLE) && typeof (x as LabelRecord).labeled_at === 'string')
        out.labels.push({ shot_id: x.shot_id, line: x.line, defect_types: t, labeled_at: (x as LabelRecord).labeled_at });
    }
  }
  if (Array.isArray(r.discards)) {
    for (const x of r.discards) {
      if (ok(x) && typeof (x as DiscardRecord).discarded_at === 'string')
        out.discards.push({ shot_id: x.shot_id, line: x.line, reason: 'UNDECIDABLE', discarded_at: (x as DiscardRecord).discarded_at });
    }
  }
  return out;
}

// ---- 저장소 (목업: 브라우저 localStorage) ----
// ponytail: 같은 PC·브라우저에서만 유지, 다른 사람과 공유 안 됨. DB API 연결 시 아래 두 함수를 API 호출로 교체
const STORAGE_KEY = 'jh.defect_labeling.v1';

export function loadStore(): LabelStore {
  try {
    const s = window.localStorage.getItem(STORAGE_KEY);
    return s ? parseStore(JSON.parse(s)) : emptyStore();
  } catch {
    return emptyStore(); // 저장소 차단(사생활 보호 모드 등)·손상된 JSON → 빈 상태로 시작
  }
}

/** 저장 성공 여부 반환 — 실패하면 화면에 알림 (라벨 유실 방지) */
export function persistStore(store: LabelStore): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
