'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchLive, fetchShots } from './api';
import type { Shot } from './types';

const POLL_MS = 5000;       // 실시간: 새 샷 조회 주기
const LIVE_MAX = 2000;      // 실시간: 화면에 두는 최근 샷 수 (계속 켜 둬도 메모리가 늘지 않게)
const MOCK_REPLAY_MS = 1200; // 목업 재생 간격 (렉 완화: 400→1200)
const MOCK_BATCH = 3;       // 틱당 추가 샷 수 (한 샷씩보다 틱 횟수 감소)
const MOCK_START = 20;      // 시작 샷 수 (150→20: 마운트 직후 분석량 축소)

/**
 * 재생(기본): 그날 샷을 한 번 받아 처음부터 차례로 보여 줌 (목업 또는 지난 날짜 실데이터)
 * 실시간(live): 오늘 현재 시각 이전 샷을 받아 두고 POLL_MS 마다 새 샷만 뒤에 붙임 (SSE/WebSocket 으로 바꿀 때도 이 훅만 수정)
 * 탭이 숨겨지면 재생·조회를 멈춰 백그라운드 CPU 낭비 방지
 * stepMs: 실데이터 재생 시 1샷 간격(ms) — 공정 최적화는 평균 사이클 ÷ 배속 (설비 장면 한 바퀴와 같음)
 */
export function useShotStream(line: string, date: string, playing: boolean, real = false, stepMs?: number, live = false) {
  const [all, setAll] = useState<Shot[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 라인·날짜·모드를 바꾼 직후 이전 조회 응답이 늦게 와서 새 화면을 덮어쓰지 않도록 현재 조회 대상 기억
  const keyRef = useRef('');
  const [visible, setVisible] = useState(true);
  const allRef = useRef<Shot[]>([]);
  allRef.current = all;

  const load = useCallback(() => {
    const key = `${line}|${date}|${live}`;
    keyRef.current = key;
    setError(null);
    // 날짜 미정: 샷 조회 안 함. loading을 켜 두지 않음(부모 dates 조회와 분리 — 무한 「불러오는 중」방지)
    if (!date) {
      setAll([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    // 이전 라인·날짜 샷을 바로 비움 — 남겨 두면 새 응답 전까지 관리도·KPI 가 이전 라인 샷으로 새 라인을 조회(404)·표시함
    setAll([]);
    setCount(0);
    const req = live ? fetchLive(line).then(r => r.shots) : fetchShots(line, date, real);
    return req
      .then(s => {
        if (keyRef.current !== key) return; // 이미 다른 라인·날짜로 바뀜
        setAll(s);
        // 실데이터 재생은 날짜를 바꾸면 처음부터 (목업은 단일 날짜라 진행 위치 유지). 실시간은 받은 샷 전부
        setCount(c => (live ? s.length : Math.min(real ? MOCK_START : Math.max(c, MOCK_START), s.length)));
      })
      .catch((e: Error) => { if (keyRef.current === key) setError(e.message); })
      .finally(() => { if (keyRef.current === key) setLoading(false); });
  }, [line, date, real, live]);

  useEffect(() => { load(); }, [load]);

  // 탭 비가시 시 스트림 일시 정지
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 재생: 받은 샷을 앞에서부터 차례로
  useEffect(() => {
    if (live || !playing || !visible || !all.length) return;
    const t = setInterval(() => setCount(c => Math.min(c + (stepMs ? 1 : MOCK_BATCH), allRef.current.length)), stepMs ?? MOCK_REPLAY_MS);
    return () => clearInterval(t);
  }, [live, playing, visible, all.length, stepMs]);

  // 실시간: 마지막 샷 이후만 조회해 뒤에 붙임 (첫 조회가 비어도 계속 기다림)
  useEffect(() => {
    if (!live || !visible || !date) return;
    const key = `${line}|${date}|${live}`;
    const t = setInterval(() => {
      fetchLive(line, allRef.current.at(-1)?.castingId)
        .then(r => {
          if (keyRef.current !== key || (!r.reset && !r.shots.length)) return;
          const next = r.reset ? r.shots : [...allRef.current, ...r.shots];
          const kept = next.length > LIVE_MAX ? next.slice(-LIVE_MAX) : next;
          setAll(kept);
          setCount(kept.length);
          setError(null);
        })
        .catch((e: Error) => { if (keyRef.current === key) setError(e.message); });
    }, POLL_MS);
    return () => clearInterval(t);
  }, [live, visible, line, date]);

  // count가 바뀔 때만 새 배열 — 불필요 slice 재생성 방지에 가깝게 유지
  const shots = useMemo(() => all.slice(0, count), [all, count]);

  return {
    shots,
    /** 받아 온 하루치 전체 (재생과 무관) — 품질 검사의 하루 전체 기준 집계용 */
    all,
    loading,
    error,
    retry: load,
    finished: !live && all.length > 0 && count >= all.length,
    restart: () => setCount(Math.min(MOCK_START, all.length)),
  };
}
