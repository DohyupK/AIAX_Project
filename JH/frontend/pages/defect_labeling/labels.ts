// 불량 유형 라벨링 — 유형 정의·선택 규칙·DB 조회 (화면·CSS import 없음) — 자체 점검: labels.check.ts
// 데이터: JH API /api/casting/defects (샷 = lake.lake_investment_casting, 라벨 = ai.defect_label·ai.defect_discard)
// 저장: POST /api/casting/defects/{casting_id}/label (서버가 쓰기 계정 app_ai 사용, 불량 유형 라벨링 edit 권한 필요)

/** 불량 유형 — code 는 화면 표시 값(= ai.defect_label 칼럼 대문자), ko 는 전문가용 보조 설명 */
export const DEFECT_TYPES = [
  { code: 'BLOWHOLE', ko: '기공' },
  { code: 'EDGE_BURR', ko: '버(Burr)·플래시(Flash) — 테두리에 남은 날카로운 살·찌꺼기' },
  { code: 'SURFACE_ROUGH', ko: '표면 결함 — 긁힘·요철·얼룩' },
  { code: 'UNDECIDABLE', ko: '판정 불가 (폐기 테이블로 이동)' },
] as const;
export type DefectCode = (typeof DEFECT_TYPES)[number]['code'];
export const UNDECIDABLE: DefectCode = 'UNDECIDABLE';

export type LabelStatus = 'unlabeled' | 'labeled' | 'discarded';

/** 불량 샷 1개 + 라벨 상태 (서버 /api/casting/defects 응답 한 줄) */
export interface DefectShot {
  castingId: string;   // DB 키 'L<라인번호>_YYMMDD_HHMMSS_생산번호'
  shotId: number;      // 생산번호 (화면 표시·목업 이미지용)
  time: string;        // 'H:mm:ss'
  status: LabelStatus;
  types: DefectCode[]; // 라벨 완료일 때 유형 (정의 순서)
}

/**
 * 유형 선택 토글 — BLOWHOLE·EDGE_BURR·SURFACE_ROUGH 는 여러 개 선택 가능,
 * UNDECIDABLE 은 단독 (고르면 나머지 해제, 다른 유형을 고르면 UNDECIDABLE 해제)
 */
export function toggleType(selected: DefectCode[], code: DefectCode): DefectCode[] {
  if (selected.includes(code)) return selected.filter(c => c !== code);
  if (code === UNDECIDABLE) return [UNDECIDABLE];
  return [...selected.filter(c => c !== UNDECIDABLE), code];
}

/** 팝업에서 보여 줄 저장된 유형 (폐기면 [UNDECIDABLE]) */
export const typesOf = (d: DefectShot): DefectCode[] => (d.status === 'discarded' ? [UNDECIDABLE] : d.types);

/** 「전체」 목록 순서: 미라벨 → 라벨 완료 → 폐기. 같은 상태 안에서는 원래 순서(최신순) 유지 */
const STATUS_ORDER: Record<LabelStatus, number> = { unlabeled: 0, labeled: 1, discarded: 2 };
export function sortByStatus<T extends { status: LabelStatus }>(items: T[]): T[] {
  return [...items].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

// ---- 조회·저장 (JH API) ----
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

async function get<T>(path: string): Promise<T> {
  // 10초 넘게 응답이 없으면 끊어 「불러오는 중」 고착 방지
  try {
    const res = await fetch(`${BASE}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`${path} 요청 실패 (HTTP ${res.status})`);
    return res.json() as Promise<T>;
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error(`${path} 요청 시간 초과 (10초) — 서버 DB(.env DATABASE_URL) 확인`);
    }
    throw e;
  }
}

/** 그 라인의 불량 샷이 있는 날짜 (최근 날짜가 먼저) */
export const fetchDefectDates = (line: string) => get<string[]>(`/api/casting/defect-dates?line=${encodeURIComponent(line)}`);
/** 그 라인·그날 불량 샷 + 라벨 상태 (최신순) */
export const fetchDefects = (line: string, date: string) =>
  get<DefectShot[]>(`/api/casting/defects?${new URLSearchParams({ line, date })}`);

/** 라벨 저장 — 서버가 기존 라벨·폐기를 지우고 새로 넣음. 실패 시 서버 안내 문구(detail)를 그대로 던짐 */
export async function saveLabel(castingId: string, types: DefectCode[]): Promise<Pick<DefectShot, 'status' | 'types'>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/casting/defects/${encodeURIComponent(castingId)}/label`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ types }),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error('저장 요청 시간 초과 (10초)');
    throw new Error('JH API 서버에 연결할 수 없습니다.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `저장 실패 (HTTP ${res.status})`);
  return body as Pick<DefectShot, 'status' | 'types'>;
}
