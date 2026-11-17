import { MODELS } from '../../pages/model_management/data';
import { getActiveModelId, toModelInfo } from './activeModel';
import type { ModelInfo, Shot } from './types';
import mockModel from './mock/model.json';

/**
 * 데이터 소스 전환 지점. 실제 DB/백엔드 연결 시:
 *   .env.local  →  NEXT_PUBLIC_USE_MOCK=false
 *                  NEXT_PUBLIC_API_BASE_URL=http://백엔드주소
 * 화면 코드는 그대로 두고 이 파일의 엔드포인트 경로만 백엔드와 맞추면 됩니다.
 *
 * 목업 shots는 public/mocks 로 두어 클라이언트 번들에 244KB JSON이 들어가지 않게 함.
 */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
// 기본: JH API 서버 (JH/api, 127.0.0.1:8000)
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
/** 정적 목업 샷 — Next public 경로 (번들 비포함) */
const MOCK_SHOTS_URL = '/mocks/casting/shots.json';
/** 브라우저 fetch 상한 — 무한 pending으로 「불러오는 중」고착 방지 */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * 목업: 설비 예열 구간(1~100번 샷, 05:02~08:13) 제외 → 101~575번 샷(475샷)만 사용
 * 예열 중에는 온도가 낮고 출렁여서, 이 구간이 관리도 기준 구간(처음 100샷)이 되면 이후 샷이 대부분 이탈로 표시됨
 * ponytail: 목업 전용. 실제 API 연결 시에는 기준 구간을 과거 정상 기간으로 정하는 것이 정석
 */
export const MOCK_WARMUP_SHOTS = 100;
/** 주조 라인 목록 — 공정 최적화·품질 검사 라인 선택 공용. ponytail: 라인이 늘거나 API로 받게 되면 조회로 교체 */
export const LINES = ['line_no1', 'line_no2', 'line_no3'] as const;
export type Line = (typeof LINES)[number];

/** 목업 데이터가 있는 라인 (line_no2·3 은 실데이터 연결 예정) */
export const MOCK_LINE = 'line_no1';

async function get<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(`${path} 요청 실패 (HTTP ${res.status})`);
    return res.json() as Promise<T>;
  } catch (e) {
    // AbortController 타임아웃 — 브라우저별 Error/DOMException
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`${path} 요청 시간 초과 (${FETCH_TIMEOUT_MS / 1000}초)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 해당 날짜의 샷별 예측 결과 (shotId 오름차순)
 * real=true 면 USE_MOCK 과 관계없이 실데이터(mes) — 공정 최적화만 먼저 전환 (품질 검사·라벨링은 모델 연결 전이라 목업)
 */
export async function fetchShots(line: string, date: string, real = false): Promise<Shot[]> {
  if (USE_MOCK && !real) {
    // 목업 데이터는 line_no1 한 라인뿐 — 다른 라인은 빈 목록(화면에 「데이터 연결 전」 표시)
    if (line !== MOCK_LINE) return [];
    // 목업: 정적 파일 fetch — 첫 방문 시 캐시 가능, JS 번들과 분리
    const res = await fetch(MOCK_SHOTS_URL, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`${MOCK_SHOTS_URL} 요청 실패 (HTTP ${res.status})`);
    return ((await res.json()) as Shot[]).slice(MOCK_WARMUP_SHOTS);
  }
  // ponytail: 매번 하루치 전체 조회. 샷이 많아지면 &since=<마지막 shotId>로 증분 조회로 바꾸세요
  return get<Shot[]>(`/api/casting/predictions?line=${encodeURIComponent(line)}&date=${date}`);
}

/** 실데이터가 있는 날짜 (최근 날짜가 먼저) */
export function fetchDates(line: string): Promise<string[]> {
  return get<string[]>(`/api/casting/dates?line=${encodeURIComponent(line)}`);
}

/** 현재 배포된 주조 불량 예측 모델 (목업: Model Management 배포 id + model.json 밴드) */
export function fetchActiveModel(): Promise<ModelInfo> {
  if (USE_MOCK) {
    const base = mockModel as unknown as ModelInfo;
    const fallbackId = MODELS.find((m) => m.deployed)?.id ?? MODELS[0]?.id ?? 1;
    const id = getActiveModelId(fallbackId);
    const m = MODELS.find((x) => x.id === id) ?? MODELS.find((x) => x.deployed) ?? MODELS[0];
    if (!m) return Promise.resolve(base);
    return Promise.resolve(toModelInfo(m, base));
  }
  return get<ModelInfo>('/api/models/active?process=casting');
}
