'use client';
import { useEffect, useMemo, useState } from 'react';
import { USE_MOCK, fetchActiveModel } from '../../common/casting/api';
import { MONITOR_KEYS, buildAlerts } from '../../common/casting/analysis';
import { useShotStream } from '../../common/casting/useShotStream';
import type { FeatureKey, ModelInfo } from '../../common/casting/types';
import KpiCards from './KpiCards';
import AlertLog from './AlertLog';
import SensorMonitor from './SensorMonitor';
import SpcChart from './SpcChart';
import s from './ProcessOptimization.module.css';

const LINE = 'line_no1';
const PRODUCT = 'CylinderHead';
// 목업 데이터 날짜. 실제 연결 시 오늘 날짜로: new Date().toISOString().slice(0, 10)
const DATE = USE_MOCK ? '2021-10-07' : new Date().toISOString().slice(0, 10);

/**
 * 공정 최적화 대시보드 — 공정 관리장용
 * 다이캐스팅 주조 공정 샷별 공정 변수 모니터링, 알람 로그, 변수별 관리도(SPC)
 */
export default function ProcessOptimizationDashboard() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [spcKey, setSpcKey] = useState<FeatureKey>(MONITOR_KEYS[0]);
  const [playing, setPlaying] = useState(true);

  const { shots, loading, error, retry, finished, restart } = useShotStream(LINE, DATE, playing);

  useEffect(() => {
    fetchActiveModel().then(setModel).catch((e: Error) => setMetaError(e.message));
  }, []);

  useEffect(() => { if (finished) setPlaying(false); }, [finished]);

  // 알람 판정 임계값은 배포 모델 기본값 사용
  const alerts = useMemo(() => (model ? buildAlerts(shots, model.threshold, model, MONITOR_KEYS) : []), [shots, model]);

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
          <span className={s.chip}>라인 <b>{LINE}</b></span>
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
          목업 데이터: 2021-10-07 실제 공정 데이터 575샷을 재생 중입니다. NEXT_PUBLIC_USE_MOCK=false 설정 시 백엔드 API로 전환됩니다.
        </div>
      )}

      {err && (
        <div className={s.errorBox} role="alert">
          <span>데이터를 불러오지 못했습니다: {err}</span>
          <button type="button" className={s.btn} onClick={() => { setMetaError(null); retry(); }}>다시 시도</button>
        </div>
      )}

      {loading && !shots.length && !err && <div className={s.panel}>데이터를 불러오는 중입니다…</div>}

      {model && latest && (
        <>
          <section className={`${s.grid} ${s.top}`}>
            {/* ponytail: 기능 미정 자리 — 내용이 정해지면 이 칸에 컴포넌트 추가 */}
            <div className={`${s.panel} ${s.placeholder}`} aria-hidden="true" />
            <div className={s.side}>
              <KpiCards shots={shots} model={model} />
              <AlertLog alerts={alerts} />
            </div>
          </section>
          <SensorMonitor shots={shots} model={model} selected={spcKey} onSelect={setSpcKey} />
          <SpcChart shots={shots} k={spcKey} />
        </>
      )}
    </div>
  );
}
