'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LINES, fetchActiveModel, fetchDates, fetchLimits, todayKst, type Line } from '../../common/casting/api';
import { buildAlertCards, type ControlLimits } from '../../common/casting/alerts';
import { LABELS } from '../../common/casting/analysis';
import { useShotStream } from '../../common/casting/useShotStream';
import type { FeatureKey, ModelInfo } from '../../common/casting/types';
import KpiCards from './KpiCards';
import AlertLog from './AlertLog';
import SensorMonitor, { SENSOR_MONITOR_ID } from './SensorMonitor';
import { BTN, CARD, CRUMB, FOCUS, H1, PAGE } from '../../common/ui';

const LOADING = `${CARD} p-5 text-sm text-gray-500 dark:text-gray-400`;
// 설비 장면·SPC는 초기 번들에서 분리 — 라우트 「페이지를 불러오는 중」노출 시간 단축
const DiecastScene = dynamic(() => import('./DiecastScene'), {
  ssr: false,
  loading: () => <div className={LOADING}>설비 장면 불러오는 중…</div>,
});
const SpcChart = dynamic(() => import('./SpcChart'), {
  ssr: false,
  loading: () => <div className={LOADING}>관리도 불러오는 중…</div>,
});

// 상단 조작 칩 — 860px 이하는 2칸 격자로 꽉 차게, 폰은 터치 높이 확대
const CHIP =
  'inline-flex h-9 min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm whitespace-nowrap text-gray-500 shadow-sm dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-400 tablet:justify-between phone:h-11';
const CHIP_SELECT = `form-select min-w-0 border-0 bg-transparent py-0 pr-7 pl-0 text-sm font-semibold text-gray-800 focus:ring-0 dark:text-gray-100 tablet:flex-1 ${FOCUS}`;

const PRODUCT = 'CylinderHead';
const DEFAULT_CYCLE = 155; // 사이클 값이 없을 때 (초)

/**
 * 공정 최적화 대시보드 — 공정 관리장용
 * 설비 장면(라벨 클릭 → 변수 모니터·관리도), 샷별 공정 변수 모니터링, 관리도 알림(고정 관리선 판정), 변수별 관리도(SPC)
 * 데이터: 실데이터(mes.investment_casting, JH API) — 오늘을 고르면 실시간 따라가기(새 샷만 5초마다), 지난 날짜는 처음부터 재생.
 * ponytail: 모델 연결 전이라 불량 = 실제 판정(passorfail), 정상 범위는 목업 model.json. 모델 API가 생기면 교체
 */
export default function ProcessOptimizationDashboard() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [limits, setLimits] = useState<ControlLimits | null>(null); // 알림 판정용 관리선 (라인별)
  const [limitsTry, setLimitsTry] = useState(0); // 「다시 시도」 시 관리선도 다시 조회
  const [metaError, setMetaError] = useState<string | null>(null);
  const [spcKey, setSpcKey] = useState<FeatureKey>('sleeve_temperature');
  const [playing, setPlaying] = useState(true);
  const [line, setLine] = useState<Line>('line_no1');
  const [activeGroup, setActiveGroup] = useState(0); // 설비 장면의 진행 중 공정 단계 묶음
  const [dates, setDates] = useState<string[] | null>(null); // null = 조회 전
  const [date, setDate] = useState(''); // 기본: 데이터가 있는 가장 최근 날짜
  const [speed, setSpeed] = useState(1); // 과거 재생 UI 배속. live 가속은 생성기 --speed 20
  const [cycle, setCycle] = useState(DEFAULT_CYCLE); // 장면 한 바퀴(초) — live=최근 샷, 재생=평균
  // 오늘(KST)은 브라우저에서만 계산 (서버 렌더 시각과 어긋나지 않게). ponytail: 페이지를 연 채 자정을 넘기면 새로고침해야 새 날짜로
  const [today, setToday] = useState('');
  useEffect(() => setToday(todayKst()), []);
  const live = !!date && date === today; // 오늘 = 실시간, 지난 날짜 = 재생
  // live: 생성기 --speed 20 이 사이클÷20 으로 넣음 → 장면은 재나눗셈 안 함. 과거 재생만 UI speed
  const sceneSpeed = live ? 1 : speed;
  const onSpeed = useCallback((next: number) => {
    setSpeed(next > 1 ? 20 : 1);
  }, []);

  // 설비 장면 라벨 클릭 → 해당 변수 선택 + 공정 변수 모니터로 스크롤 (바로 아래 관리도도 같은 변수)
  const pickFromScene = useCallback((k: FeatureKey) => {
    setSpcKey(k);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(SENSOR_MONITOR_ID)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const { shots, loading, error, retry, finished, restart } = useShotStream(
    line, date, playing, true, (cycle / sceneSpeed) * 1000, live,
  );

  // live: 최근 샷 사이클(×20 직후 ~7.5초가 바로 반영). 재생: 평균(정수 초)으로 타이머 안정
  useEffect(() => {
    if (live) {
      const last = shots[shots.length - 1]?.features.facility_CycleTime;
      setCycle(last != null && last > 0 ? last : DEFAULT_CYCLE);
      return;
    }
    const v = shots.map(x => x.features.facility_CycleTime).filter((x): x is number => x != null && x > 0);
    setCycle(v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : DEFAULT_CYCLE);
  }, [shots, live]);

  useEffect(() => {
    fetchActiveModel().then(setModel).catch((e: Error) => setMetaError(e.message));
  }, []);

  useEffect(() => {
    let alive = true;
    setDates(null);
    fetchDates(line)
      .then(ds => { if (alive) { setDates(ds); setDate(d => (ds.includes(d) ? d : ds[0] ?? '')); } })
      .catch((e: Error) => { if (alive) setMetaError(e.message); });
    return () => { alive = false; };
  }, [line]);

  // 라인이 바뀌면 그 라인 관리선 (서버 고정 표 — 관리도와 같은 값)
  useEffect(() => {
    let alive = true;
    setLimits(null);
    fetchLimits(line)
      .then(l => { if (alive) setLimits(l); })
      .catch((e: Error) => {
        console.error('[process_optimization] 관리선 조회 실패', line, e);
        if (alive) setMetaError(e.message);
      });
    return () => { alive = false; };
  }, [line, limitsTry]);

  useEffect(() => { if (finished) setPlaying(false); }, [finished]);

  // 알림 판정 — 받은 샷 전체를 처음부터 (런 상태·중복 방지 규칙이 순서에 따라 정해지므로). 하루 수백 샷이라 매 샷 다시 계산해도 가벼움
  const cards = useMemo(
    () => (limits && limits.line === line && date ? buildAlertCards(shots, limits, date, LABELS) : []),
    [shots, limits, line, date],
  );

  const latest = shots[shots.length - 1];
  const err = error ?? metaError;

  const togglePlay = () => {
    if (!playing && finished) restart();
    setPlaying(p => !p);
  };

  return (
    <div className={`${PAGE} flex flex-col gap-6 phone:gap-4`}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={CRUMB}>주조 공정 대시보드 › 공정 최적화</div>
          <h1 className={H1}>공정 최적화 대시보드</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 tablet:grid tablet:w-full tablet:grid-cols-2">
          <label className={CHIP}>
            라인
            <select className={CHIP_SELECT} value={line} aria-label="라인 선택"
              onChange={e => setLine(e.target.value as Line)}>
              {LINES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className={CHIP}>
            날짜
            <select className={CHIP_SELECT} value={date} aria-label="날짜 선택" disabled={!dates?.length}
              onChange={e => { setDate(e.target.value); setPlaying(true); }}>
              {dates?.map(d => <option key={d} value={d}>{d === today ? `${d} (실시간)` : d}</option>)}
            </select>
          </label>
          <span className={CHIP}>품목 <b className="font-semibold text-gray-800 dark:text-gray-100">{PRODUCT}</b></span>
          <span className={`${CHIP} ${live ? 'tablet:col-span-2' : ''}`}>
            <span className="flex items-center gap-2">
              <span className={`size-2 shrink-0 rounded-full ${live || playing ? 'animate-pulse bg-green-500 motion-reduce:animate-none' : 'bg-gray-400'}`} />
              <b className="font-semibold text-gray-800 dark:text-gray-100">{live ? '실시간' : playing ? '재생 중' : finished ? '재생 종료' : '일시정지'}</b>
            </span>
            {latest && <span className="truncate font-mono text-xs tabular-nums">{date} {latest.time}</span>}
          </span>
          {/* 실시간은 새 샷이 오는 대로 따라가므로 재생·일시정지 없음 */}
          {!live && <button type="button" className={`${BTN} h-9 phone:h-11 tablet:col-span-2`} onClick={togglePlay}>{playing ? '일시정지' : '재생'}</button>}
        </div>
      </header>

      <p className="rounded-lg bg-sky-500/10 px-4 py-2.5 text-sm text-sky-800 dark:text-sky-300">
        {live
          ? '실시간(공정 DB): 오늘 지금까지의 최근 샷을 보여 주고, 새 샷이 들어오면 5초 안에 이어 붙입니다. 시연 가속은 샷 생성기 --speed 20 (사이클·간격 ÷20).'
          : '실데이터(공정 DB): 고른 날짜의 샷을 처음부터 재생합니다. 1샷 = 평균 설비 사이클(×20 버튼으로 20배속).'}
        {' '}알림은 불량 예측과 별개로 고정 관리선(기준 기간 정상 양품 샷)으로 기준 기간 다음 날부터 판정합니다 — 경보(설비 한계) · 주의(관리선 밖) · 관찰(추세).
      </p>

      {err && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400" role="alert">
          <span className="min-w-0 flex-1">데이터를 불러오지 못했습니다: {err}</span>
          <button type="button" className={BTN} onClick={() => {
            setMetaError(null);
            // 날짜 목록부터 다시
            setDates(null);
            fetchDates(line)
              .then(ds => { setDates(ds); setDate(d => (ds.includes(d) ? d : ds[0] ?? '')); })
              .catch((e: Error) => setMetaError(e.message));
            if (!limits) setLimitsTry(n => n + 1);
            retry();
          }}>다시 시도</button>
        </div>
      )}

      {/* 셸(헤더·배너)은 유지하고 데이터 영역만 상태 표시 */}
      {dates === null && !err && <div className={LOADING}>날짜 목록을 불러오는 중입니다…</div>}
      {loading && !!date && !shots.length && !err && <div className={LOADING}>데이터를 불러오는 중입니다…</div>}
      {/* 해당 라인의 샷이 아직 없음 (목업: line_no1 만 데이터 있음 / 실제: 오늘 생산 전이거나 미연결) */}
      {(dates?.length === 0 || (!loading && date && !shots.length)) && !err && (
        <div className={`${CARD} flex min-h-60 flex-col items-center justify-center gap-1.5 p-5 text-center text-sm text-gray-700 dark:text-gray-200`} role="status">
          <span><b>{line}</b> 데이터가 아직 연결되지 않았습니다.</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">라인 설비 데이터가 연결되면 설비 장면·공정 변수·관리도가 표시됩니다.</span>
        </div>
      )}

      {/* 모델만 있으면 골격 표시 — latest 대기 중에도 장면·패널 자리 확보 */}
      {model && (
        <>
          {/* PC: 장면 | KPI + 알림. 1180px 이하: 장면 아래로 */}
          <section className="grid gap-6 phone:gap-4 min-[1181px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <DiecastScene shots={shots} model={model} playing={live || playing} cycleSec={cycle}
              speed={speed} sceneSpeed={sceneSpeed} onSpeed={onSpeed} onPick={pickFromScene} onPhase={setActiveGroup} />
            <div className="flex min-w-0 flex-col gap-6 phone:gap-4">
              <KpiCards shots={shots} model={model} />
              <AlertLog cards={cards} limits={limits && limits.line === line ? limits : null} date={date} />
            </div>
          </section>
          <SensorMonitor shots={shots} model={model} selected={spcKey} onSelect={setSpcKey} activeGroup={activeGroup} />
          <SpcChart shots={shots} k={spcKey} line={line} />
        </>
      )}
    </div>
  );
}
