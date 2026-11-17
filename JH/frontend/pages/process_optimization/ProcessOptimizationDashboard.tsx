'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LINES, fetchActiveModel, fetchDates, type Line } from '../../common/casting/api';
import { MONITOR_KEYS, buildAlerts } from '../../common/casting/analysis';
import { useShotStream } from '../../common/casting/useShotStream';
import type { FeatureKey, ModelInfo } from '../../common/casting/types';
import KpiCards from './KpiCards';
import AlertLog from './AlertLog';
import SensorMonitor, { SENSOR_MONITOR_ID } from './SensorMonitor';
import s from './ProcessOptimization.module.css';

// 설비 장면·SPC는 초기 번들에서 분리 — 라우트 「페이지를 불러오는 중」노출 시간 단축
const DiecastScene = dynamic(() => import('./DiecastScene'), {
  ssr: false,
  loading: () => <div className={s.panel}>설비 장면 불러오는 중…</div>,
});
const SpcChart = dynamic(() => import('./SpcChart'), {
  ssr: false,
  loading: () => <div className={s.panel}>관리도 불러오는 중…</div>,
});

const PRODUCT = 'CylinderHead';
const DEFAULT_CYCLE = 155; // 사이클 값이 없을 때 (초)

/**
 * 공정 최적화 대시보드 — 공정 관리장용
 * 설비 장면(라벨 클릭 → 변수 모니터·관리도), 샷별 공정 변수 모니터링, 알람 로그, 변수별 관리도(SPC)
 * 데이터: 실데이터(mes.investment_casting, JH API) — 고른 날짜를 처음부터 재생.
 * ponytail: 모델 연결 전이라 불량 = 실제 판정(passorfail), 정상 범위는 목업 model.json. 모델 API가 생기면 교체
 */
export default function ProcessOptimizationDashboard() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [spcKey, setSpcKey] = useState<FeatureKey>('sleeve_temperature');
  const [playing, setPlaying] = useState(true);
  const [line, setLine] = useState<Line>('line_no1');
  const [activeGroup, setActiveGroup] = useState(0); // 설비 장면의 진행 중 공정 단계 묶음
  const [dates, setDates] = useState<string[] | null>(null); // null = 조회 전
  const [date, setDate] = useState(''); // 기본: 데이터가 있는 가장 최근 날짜
  const [speed, setSpeed] = useState(1);
  const [cycle, setCycle] = useState(DEFAULT_CYCLE); // 지금까지 받은 샷의 평균 설비 사이클(초)

  // 설비 장면 라벨 클릭 → 해당 변수 선택 + 공정 변수 모니터로 스크롤 (바로 아래 관리도도 같은 변수)
  const pickFromScene = useCallback((k: FeatureKey) => {
    setSpcKey(k);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(SENSOR_MONITOR_ID)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const { shots, loading, error, retry, finished, restart } = useShotStream(line, date, playing, true, (cycle / speed) * 1000);

  // 평균 설비 사이클 = KPI 「평균 사이클」과 같은 값. 정수 초로 반올림해 재생 타이머가 매 샷마다 다시 걸리지 않게
  useEffect(() => {
    const v = shots.map(x => x.features.facility_CycleTime).filter((x): x is number => x != null && x > 0);
    setCycle(v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : DEFAULT_CYCLE);
  }, [shots]);

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

  useEffect(() => { if (finished) setPlaying(false); }, [finished]);

  const lastId = shots.length ? shots[shots.length - 1].shotId : 0;
  // 알람 판정 — shots 참조 + lastId로 동일 틱 중복 계산 방지에 가깝게
  const alerts = useMemo(
    () => (model ? buildAlerts(shots, model, MONITOR_KEYS) : []),
    [shots, model, lastId],
  );

  const latest = shots[shots.length - 1];
  const err = error ?? metaError;

  const togglePlay = () => {
    if (!playing && finished) restart();
    setPlaying(p => !p);
  };

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <div className={s.crumb}>주조 공정 대시보드 › 공정 최적화</div>
          <h2 className={s.title}>공정 최적화 대시보드</h2>
        </div>
        <div className={s.chips}>
          <label className={s.chip}>
            라인
            <select className={s.chipSelect} value={line} aria-label="라인 선택"
              onChange={e => setLine(e.target.value as Line)}>
              {LINES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className={s.chip}>
            날짜
            <select className={s.chipSelect} value={date} aria-label="날짜 선택" disabled={!dates?.length}
              onChange={e => { setDate(e.target.value); setPlaying(true); }}>
              {dates?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <span className={s.chip}>품목 <b>{PRODUCT}</b></span>
          {model && (
            <span className={s.chip} title="Model Management에서 배포된 모델">
              모델 <b>{model.name} {model.version}</b>
            </span>
          )}
          <span className={s.chip}>
            <span className={`${s.dot} ${playing ? s.dotLive : ''}`} />
            <b>{playing ? '실시간' : finished ? '재생 종료' : '일시정지'}</b>
            {latest && <span className={s.num}>· {date} {latest.time}</span>}
          </span>
          <button type="button" className={s.btn} onClick={togglePlay}>{playing ? '일시정지' : '재생'}</button>
        </div>
      </header>

      <div className={s.banner}>
        실데이터(공정 DB): 고른 날짜의 샷을 처음부터 재생합니다. 1샷 = 평균 설비 사이클(×20 버튼으로 20배속). 알람은 공정 변수 모니터에서 주의·이탈로 바뀌는 순간 울립니다.
      </div>

      {err && (
        <div className={s.errorBox} role="alert">
          <span>데이터를 불러오지 못했습니다: {err}</span>
          <button type="button" className={s.btn} onClick={() => {
            setMetaError(null);
            // 날짜 목록부터 다시
            setDates(null);
            fetchDates(line)
              .then(ds => { setDates(ds); setDate(d => (ds.includes(d) ? d : ds[0] ?? '')); })
              .catch((e: Error) => setMetaError(e.message));
            retry();
          }}>다시 시도</button>
        </div>
      )}

      {/* 셸(헤더·배너)은 유지하고 데이터 영역만 상태 표시 */}
      {dates === null && !err && <div className={s.panel}>날짜 목록을 불러오는 중입니다…</div>}
      {loading && !!date && !shots.length && !err && <div className={s.panel}>데이터를 불러오는 중입니다…</div>}
      {/* 해당 라인의 샷이 아직 없음 (목업: line_no1 만 데이터 있음 / 실제: 오늘 생산 전이거나 미연결) */}
      {(dates?.length === 0 || (!loading && date && !shots.length)) && !err && (
        <div className={`${s.panel} ${s.emptyLine}`} role="status">
          <b>{line}</b> 데이터가 아직 연결되지 않았습니다.
          <span className={s.sub}>라인 설비 데이터가 연결되면 설비 장면·공정 변수·관리도가 표시됩니다.</span>
        </div>
      )}

      {/* 모델만 있으면 골격 표시 — latest 대기 중에도 장면·패널 자리 확보 */}
      {model && (
        <>
          <section className={`${s.grid} ${s.top}`}>
            <DiecastScene shots={shots} model={model} playing={playing} cycleSec={cycle} speed={speed} onSpeed={setSpeed} onPick={pickFromScene} onPhase={setActiveGroup} />
            <div className={s.side}>
              <KpiCards shots={shots} model={model} />
              <AlertLog alerts={alerts} />
            </div>
          </section>
          <SensorMonitor shots={shots} model={model} selected={spcKey} onSelect={setSpcKey} activeGroup={activeGroup} />
          <SpcChart shots={shots} k={spcKey} />
        </>
      )}
    </div>
  );
}
