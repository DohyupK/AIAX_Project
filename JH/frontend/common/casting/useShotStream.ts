'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchShots, USE_MOCK } from './api';
import type { Shot } from './types';

const POLL_MS = 5000;       // 실제 API 폴링 주기
const MOCK_REPLAY_MS = 1200; // 목업 재생 간격 (렉 완화: 400→1200)
const MOCK_BATCH = 3;       // 틱당 추가 샷 수 (한 샷씩보다 틱 횟수 감소)
const MOCK_START = 20;      // 시작 샷 수 (150→20: 마운트 직후 분석량 축소)

/**
 * 목업: 하루치 데이터를 배치로 재생해 실시간처럼 보여줌
 * 실제: POLL_MS마다 API를 다시 조회 (SSE/WebSocket으로 바꿀 때도 이 훅만 수정)
 * 탭이 숨겨지면 재생·폴링을 멈춰 백그라운드 CPU 낭비 방지
 */
export function useShotStream(line: string, date: string, playing: boolean) {
  const [all, setAll] = useState<Shot[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const allLenRef = useRef(0);
  allLenRef.current = all.length;

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

  // 탭 비가시 시 스트림 일시 정지
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!playing || !visible || !all.length) return;
    const t = setInterval(() => {
      if (USE_MOCK) {
        setCount(c => Math.min(c + MOCK_BATCH, allLenRef.current));
      } else {
        fetchShots(line, date)
          .then(s => { setAll(s); setCount(s.length); })
          .catch((e: Error) => setError(e.message));
      }
    }, USE_MOCK ? MOCK_REPLAY_MS : POLL_MS);
    return () => clearInterval(t);
  }, [playing, visible, all.length, line, date]);

  // count가 바뀔 때만 새 배열 — 불필요 slice 재생성 방지에 가깝게 유지
  const shots = useMemo(() => all.slice(0, count), [all, count]);

  return {
    shots,
    loading,
    error,
    retry: load,
    finished: USE_MOCK && all.length > 0 && count >= all.length,
    restart: () => setCount(Math.min(MOCK_START, all.length)),
  };
}
