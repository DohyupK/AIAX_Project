'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetchShots, USE_MOCK } from './api';
import type { Shot } from './types';

const POLL_MS = 5000;     // 실제 API 폴링 주기
const MOCK_REPLAY_MS = 400; // 목업 재생 간격 (한 샷씩)
const MOCK_START = 150;   // 목업 재생 시작 시 미리 보여줄 샷 수

/**
 * 목업: 하루치 데이터를 한 샷씩 재생해 실시간처럼 보여줌
 * 실제: POLL_MS마다 API를 다시 조회 (SSE/WebSocket으로 바꿀 때도 이 훅만 수정)
 */
export function useShotStream(line: string, date: string, playing: boolean) {
  const [all, setAll] = useState<Shot[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchShots(line, date)
      .then(s => {
        setAll(s);
        setCount(c => (USE_MOCK ? Math.max(c, Math.min(MOCK_START, s.length)) : s.length));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [line, date]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!playing || !all.length) return;
    const t = setInterval(() => {
      if (USE_MOCK) setCount(c => Math.min(c + 1, all.length));
      else fetchShots(line, date).then(s => { setAll(s); setCount(s.length); }).catch((e: Error) => setError(e.message));
    }, USE_MOCK ? MOCK_REPLAY_MS : POLL_MS);
    return () => clearInterval(t);
  }, [playing, all.length, line, date]);

  return {
    shots: all.slice(0, count),
    loading,
    error,
    retry: load,
    finished: USE_MOCK && all.length > 0 && count >= all.length,
    restart: () => setCount(Math.min(MOCK_START, all.length)),
  };
}
