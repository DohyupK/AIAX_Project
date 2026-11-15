'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LINES, USE_MOCK, fetchActiveModel, type Line } from '../../common/casting/api';
import { MONITOR_KEYS, buildAlerts } from '../../common/casting/analysis';
import { useShotStream } from '../../common/casting/useShotStream';
import type { FeatureKey, ModelInfo } from '../../common/casting/types';
import KpiCards from './KpiCards';
import AlertLog from './AlertLog';
import SensorMonitor, { SENSOR_MONITOR_ID } from './SensorMonitor';
import DiecastScene from './DiecastScene';
import s from './ProcessOptimization.module.css';

// SPC 차트는 초기 번들에서 분리 — 마운트 후 로드
const SpcChart = dynamic(() => import('./SpcChart'), {
  ssr: false,
  loading: () => <div className={s.panel}>관리도 불러오는 중…</div>,
});

const PRODUCT = 'CylinderHead';
// 목업 데이터 날짜. 실제 연결 시 오늘 날짜로: new Date().toISOString().slice(0, 10)
const DATE = USE_MOCK ? '2021-10-07' : new Date().toISOString().slice(0, 10);

/**
 * 공정 최적화 대시보드 — 공정 관리장용
 * 설비 장면(라벨 클릭 → 변수 모니터·관리도), 샷별 공정 변수 모니터링, 알람 로그, 변수별 관리도(SPC)
 */
export default function ProcessOptimizationDashboard() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [spcKey, setSpcKey] = useState<FeatureKey>('sleeve_temperature');
  const [playing, setPlaying] = useState(true);
  const [line, setLine] = useState<Line>('line_no1');
  const [activeGroup, setActiveGroup] = useState(0); // 설비 장면의 진행 중 공정 단계 묶음

  // 설비 장면 라벨 클릭 → 해당 변수 선택 + 공정 변수 모니터로 스크롤 (바로 아래 관리도도 같은 변수)
  const pickFromScene = useCallback((k: FeatureKey) => {
    setSpcKey(k);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(SENSOR_MONITOR_ID)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const { shots, loading, error, retry, finished, restart } = useShotStream(line, DATE, playing);

  useEffect(() => {
    fetchActiveModel().then(setModel).catch((e: Error) => setMetaError(e.message));
  }, []);

  useEffect(() => { if (finished) setPlaying(false); }, [finished]);

  const lastId = shots.length ? shots[shots.length - 1].shotId : 0;
  // 알람 판정 — shots 참조 + lastId로 동일 틱 중복 계산 방지에 가깝게
  const alerts = useMemo(
    () => (model ? buildAlerts(shots, model.threshold, model, MONITOR_KEYS) : []),
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
          <span className={s.chip}>품목 <b>{PRODUCT}</b></span>
          {model && (
            <span className={s.chip} title="Model Management에서 배포된 모델">
              모델 <b>{model.name} {model.version}</b>
            </span>
          )}
          <span className={s.chip}>
            <span className={`${s.dot} ${playing ? s.dotLive : ''}`} />
            <b>{playing ? '실시간' : finished ? '재생 종료' : '일시정지'}</b>
            {latest && <span className={s.num}>· {DATE} {latest.time}</span>}
          </span>
          <button type="button" className={s.btn} onClick={togglePlay}>{playing ? '일시정지' : '재생'}</button>
        </div>
      </header>

      {USE_MOCK && (
        <div className={s.banner}>
          목업 데이터(line_no1만 제공, line_no2·3은 연결 예정): 2021-10-07 실제 공정 데이터 중 설비 예열 구간(1~100번 샷)을 뺀 475샷(08:14~)을 재생 중입니다. NEXT_PUBLIC_USE_MOCK=false 설정 시 백엔드 API로 전환됩니다.
        </div>
      )}

      {err && (
        <div className={s.errorBox} role="alert">
          <span>데이터를 불러오지 못했습니다: {err}</span>
          <button type="button" className={s.btn} onClick={() => { setMetaError(null); retry(); }}>다시 시도</button>
        </div>
      )}

      {loading && !shots.length && !err && <div className={s.panel}>데이터를 불러오는 중입니다…</div>}
      {/* 해당 라인의 샷이 아직 없음 (목업: line_no1 만 데이터 있음 / 실제: 오늘 생산 전이거나 미연결) */}
      {!loading && !shots.length && !err && (
        <div className={`${s.panel} ${s.emptyLine}`} role="status">
          <b>{line}</b> 데이터가 아직 연결되지 않았습니다.
          <span className={s.sub}>라인 설비 데이터가 연결되면 설비 장면·공정 변수·관리도가 표시됩니다.</span>
        </div>
      )}

      {model && latest && (
        <>
          <section className={`${s.grid} ${s.top}`}>
            <DiecastScene shots={shots} model={model} playing={playing} onPick={pickFromScene} onPhase={setActiveGroup} />
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
