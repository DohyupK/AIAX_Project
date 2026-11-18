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
/** stepMs: 실데이터 재생 시 1샷 간격(ms) — 공정 최적화는 평균 사이클 ÷ 배속 (설비 장면 한 바퀴와 같음) */
export function useShotStream(line: string, date: string, playing: boolean, real = false, stepMs?: number) {
  // 재생 모드: 목업, 또는 지난 날짜 실데이터(real) — 하루치를 받아 처음부터 재생
  const replay = USE_MOCK || real;
  const [all, setAll] = useState<Shot[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 라인·날짜를 바꾼 직후 이전 조회 응답이 늦게 와서 새 화면을 덮어쓰지 않도록 현재 조회 대상 기억
  const keyRef = useRef('');
  const [visible, setVisible] = useState(true);
  const allLenRef = useRef(0);
  allLenRef.current = all.length;

  const load = useCallback(() => {
    const key = `${line}|${date}`;
    keyRef.current = key;
    setError(null);
    // 날짜 미정: 샷 조회 안 함. loading을 켜 두지 않음(부모 dates 조회와 분리 — 무한 「불러오는 중」방지)
    if (!date) {
      setAll([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return fetchShots(line, date, real)
      .then(s => {
        if (keyRef.current !== key) return; // 이미 다른 라인·날짜로 바뀜
        setAll(s);
        // 실데이터 재생은 날짜를 바꾸면 처음부터 (목업은 단일 날짜라 진행 위치 유지)
        setCount(c => (replay ? Math.min(real ? MOCK_START : Math.max(c, MOCK_START), s.length) : s.length));
      })
      .catch((e: Error) => { if (keyRef.current === key) setError(e.message); })
      .finally(() => { if (keyRef.current === key) setLoading(false); });
  }, [line, date, real, replay]);

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
      if (replay) {
        setCount(c => Math.min(c + (stepMs ? 1 : MOCK_BATCH), allLenRef.current));
      } else {
        const key = `${line}|${date}`;
        fetchShots(line, date)
          .then(s => { if (keyRef.current === key) { setAll(s); setCount(s.length); } })
          .catch((e: Error) => { if (keyRef.current === key) setError(e.message); });
      }
    }, replay ? (stepMs ?? MOCK_REPLAY_MS) : POLL_MS);
    return () => clearInterval(t);
  }, [playing, visible, all.length, line, date, replay, stepMs]);

  // count가 바뀔 때만 새 배열 — 불필요 slice 재생성 방지에 가깝게 유지
  const shots = useMemo(() => all.slice(0, count), [all, count]);

  return {
    shots,
    /** 받아 온 하루치 전체 (재생과 무관) — 품질 검사의 하루 전체 기준 집계용 */
    all,
    loading,
    error,
    retry: load,
    finished: replay && all.length > 0 && count >= all.length,
    restart: () => setCount(Math.min(MOCK_START, all.length)),
  };
}
