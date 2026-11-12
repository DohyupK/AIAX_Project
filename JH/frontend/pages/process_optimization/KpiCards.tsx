import { MONITOR_KEYS, isOutOfRange } from '../../common/casting/analysis';
import type { ModelInfo, Shot } from '../../common/casting/types';
import s from './ProcessOptimization.module.css';

// 'H:mm:ss' → 초
const toSec = (t: string) => t.split(':').reduce((acc, x) => acc * 60 + Number(x), 0);

/** 공정 요약 지표: 오늘 생산 샷 · 시간당 샷 · 평균 사이클 · 범위 이탈 샷 */
export default function KpiCards({ shots, model }: { shots: Shot[]; model: ModelInfo }) {
  const first = shots[0], last = shots[shots.length - 1];
  const hours = first && last ? (toSec(last.time) - toSec(first.time)) / 3600 : 0;
  const perHour = hours > 0 ? (shots.length - 1) / hours : null;
  const cycles = shots.map(x => x.features.facility_CycleTime).filter((x): x is number => x != null);
  const avgCycle = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null;
  const outCount = shots.filter(x => isOutOfRange(x, model, MONITOR_KEYS)).length;

  return (
    <section className={`${s.grid} ${s.kpis}`} aria-label="공정 요약 지표">
      <div className={`${s.panel} ${s.kpi}`}>
        <span className={s.kpiLabel}>오늘 생산 샷</span>
        <span className={`${s.kpiValue} ${s.num}`}>{shots.length.toLocaleString()}</span>
        <span className={s.sub}>{last ? `최근 샷 #${last.shotId}` : '—'}</span>
      </div>
      <div className={`${s.panel} ${s.kpi}`}>
        <span className={s.kpiLabel}>시간당 샷</span>
        <span className={`${s.kpiValue} ${s.num}`}>{perHour == null ? '—' : perHour.toFixed(1)}<small>샷/h</small></span>
        <span className={s.sub}>{first && last ? `${first.time} ~ ${last.time}` : '—'}</span>
      </div>
      <div className={`${s.panel} ${s.kpi}`}>
        <span className={s.kpiLabel}>평균 사이클</span>
        <span className={`${s.kpiValue} ${s.num}`}>{avgCycle == null ? '—' : avgCycle.toFixed(1)}<small>초</small></span>
        <span className={s.sub}>설비 사이클 기준</span>
      </div>
      <div className={`${s.panel} ${s.kpi} ${s[outCount ? 'kpi_warn' : 'kpi_ok']}`}>
        <span className={s.kpiLabel}>범위 이탈 샷</span>
        <span className={`${s.kpiValue} ${s.num}`}>{outCount}<small>샷</small></span>
        <span className={s.sub}>공정 변수 8개 중 하나라도 정상 범위 밖</span>
      </div>
    </section>
  );
}
