import type { MlModel, ModelInfo, SecondCheck, Shot } from './types';
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
  return get<Shot[]>(`/api/casting/predictions?line=${encodeURIComponent(line)}&date=${date}`);
}

/** 실시간 응답 — reset=true 면 목록 교체(첫 조회·날짜 바뀜), false 면 뒤에 붙임 */
export interface LiveShots { date: string; reset: boolean; shots: Shot[] }

/** 실시간 따라가기 — 오늘(KST) 현재 시각 이전 샷. after(마지막 castingId) 이후만 받음 */
export function fetchLive(line: string, after?: string): Promise<LiveShots> {
  const q = new URLSearchParams({ line, ...(after ? { after } : {}) });
  return get<LiveShots>(`/api/casting/live?${q}`);
}

/** 오늘 날짜 (KST, 'YYYY-MM-DD') — 공정 최적화: 오늘이면 실시간, 지난 날짜면 재생 */
export const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

/**
 * 2차(DL) 판정 — 그날 그 라인의 이미지가 있는 샷만 (1차 양품 거르기는 화면에서)
 * ponytail: 처음 조회 시 이미지마다 추론(장당 ~0.5초). 이미지가 수십 장 넘게 쌓이면 10초 제한에 걸리므로 추론 결과 DB 저장(ai.quality_prediction) 후 조회만 하도록 바꿀 것
 */
export function fetchSecond(line: string, date: string): Promise<SecondCheck> {
  return get<SecondCheck>(`/api/casting/second?line=${encodeURIComponent(line)}&date=${date}`);
}

/** 실데이터가 있는 날짜 (최근 날짜가 먼저) */
export function fetchDates(line: string): Promise<string[]> {
  return get<string[]>(`/api/casting/dates?line=${encodeURIComponent(line)}`);
}

/** 1차(ML) 검사 모델 정보 — 실데이터 화면용 (JH API 가 TM 배포 pkl 로 점수 계산) */
export function fetchMlModel(): Promise<MlModel> {
  return get<MlModel>('/api/casting/model');
}

/**
 * 공정 변수 정상 범위(bands)·변수 영향도 — 공정 모니터·주요 변수용 목업 (mock/model.json)
 * ponytail: 정상 범위를 DB·모델에서 받게 되면 이 함수만 API 호출로 교체. 배포 모델 이름은 Model Management(DB)에서
 */
export function fetchActiveModel(): Promise<ModelInfo> {
  return Promise.resolve(mockModel as unknown as ModelInfo);
}
