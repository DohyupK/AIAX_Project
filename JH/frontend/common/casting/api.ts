import type { ModelInfo, Shot } from './types';
import mockShots from './mock/shots.json';
import mockModel from './mock/model.json';

/**
 * 데이터 소스 전환 지점. 실제 DB/백엔드 연결 시:
 *   .env.local  →  NEXT_PUBLIC_USE_MOCK=false
 *                  NEXT_PUBLIC_API_BASE_URL=http://백엔드주소
 * 화면 코드는 그대로 두고 이 파일의 엔드포인트 경로만 백엔드와 맞추면 됩니다.
 */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} 요청 실패 (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

/** 해당 날짜의 샷별 예측 결과 (shotId 오름차순) */
export function fetchShots(line: string, date: string): Promise<Shot[]> {
  if (USE_MOCK) return Promise.resolve(mockShots as unknown as Shot[]);
  // ponytail: 매번 하루치 전체 조회. 샷이 많아지면 &since=<마지막 shotId>로 증분 조회로 바꾸세요
  return get<Shot[]>(`/api/casting/predictions?line=${encodeURIComponent(line)}&date=${date}`);
}

/** 현재 배포된 주조 불량 예측 모델 */
export function fetchActiveModel(): Promise<ModelInfo> {
  if (USE_MOCK) return Promise.resolve(mockModel as unknown as ModelInfo);
  return get<ModelInfo>('/api/models/active?process=casting');
}

