'use client';
import { useState } from 'react';
import { API_BASE } from './api';

/**
 * 샷 촬영 사진 — 불량 유형 라벨링용
 * 사진 = MS 이미지 API GET /api/images/{casting_id} (서버 /root/images 의 jpg). 서버에 사진이 없거나(404) 연결이 안 되면 「이미지 없음」
 */
export default function ShotImage({ castingId, className }: { castingId: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={className} role="img" aria-label={`${castingId} 이미지 없음`}
        style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', background: '#2b2f36', color: '#9aa0a8', fontSize: 12 }}>
        이미지 없음
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 외부 API 사진, next/image 최적화 대상 아님
    <img src={`${API_BASE}/api/images/${encodeURIComponent(castingId)}`} alt={`${castingId} 촬영 사진`}
      className={className} loading="lazy" onError={() => setFailed(true)} />
  );
}
