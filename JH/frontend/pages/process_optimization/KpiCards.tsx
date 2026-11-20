import { memo, useMemo } from 'react';
import { MONITOR_KEYS, isOutOfRange } from '../../common/casting/analysis';
import type { ModelInfo, Shot } from '../../common/casting/types';
import { CARD } from '../../common/ui';

// 'H:mm:ss' → 초
const toSec = (t: string) => t.split(':').reduce((acc, x) => acc * 60 + Number(x), 0);

const KPI = `${CARD} flex flex-col gap-0.5 p-4 phone:p-3`;
const LABEL = 'text-xs font-semibold text-gray-400 uppercase dark:text-gray-500';
const VALUE = 'text-3xl font-bold tabular-nums text-gray-800 dark:text-gray-100 phone:text-2xl';
const UNIT = 'ml-1 text-sm font-medium text-gray-400 dark:text-gray-500';
const NOTE = 'truncate text-xs text-gray-500 dark:text-gray-400';

/** 공정 요약 지표: 오늘 생산 샷 · 시간당 샷 · 평균 사이클 · 범위 이탈 샷 */
function KpiCards({ shots, model }: { shots: Shot[]; model: ModelInfo }) {
  const lastId = shots.length ? shots[shots.length - 1].shotId : 0;
  const stats = useMemo(() => {
    const first = shots[0], last = shots[shots.length - 1];
    const hours = first && last ? (toSec(last.time) - toSec(first.time)) / 3600 : 0;
    const perHour = hours > 0 ? (shots.length - 1) / hours : null;
    const cycles = shots.map(x => x.features.facility_CycleTime).filter((x): x is number => x != null);
    const avgCycle = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null;
    const outCount = shots.filter(x => isOutOfRange(x, model, MONITOR_KEYS)).length;
    return { first, last, perHour, avgCycle, outCount };
  }, [shots, model, lastId]);

  const { first, last, perHour, avgCycle, outCount } = stats;

  return (
    <section className="grid grid-cols-2 gap-4 phone:gap-3" aria-label="공정 요약 지표">
      <div className={KPI}>
        <span className={LABEL}>오늘 생산 샷</span>
        <span className={VALUE}>{shots.length.toLocaleString()}</span>
        <span className={NOTE}>{last ? `최근 샷 #${last.shotId}` : '—'}</span>
      </div>
      <div className={KPI}>
        <span className={LABEL}>시간당 샷</span>
        <span className={VALUE}>{perHour == null ? '—' : perHour.toFixed(1)}<small className={UNIT}>샷/h</small></span>
        <span className={NOTE}>{first && last ? `${first.time} ~ ${last.time}` : '—'}</span>
      </div>
      <div className={KPI}>
        <span className={LABEL}>평균 사이클</span>
        <span className={VALUE}>{avgCycle == null ? '—' : avgCycle.toFixed(1)}<small className={UNIT}>초</small></span>
        <span className={NOTE}>설비 사이클 기준</span>
      </div>
      <div className={KPI}>
        <span className={LABEL}>범위 이탈 샷</span>
        {/* 이탈 샷이 있으면 노랑, 없으면 초록 */}
        <span className={`${VALUE} ${outCount ? '!text-yellow-600 dark:!text-yellow-500' : '!text-green-600 dark:!text-green-500'}`}>
          {outCount}<small className={UNIT}>샷</small>
        </span>
        <span className={NOTE} title={`공정 변수 ${MONITOR_KEYS.length}개 중 하나라도 정상 범위 밖`}>
          공정 변수 {MONITOR_KEYS.length}개 중 하나라도 정상 범위 밖
        </span>
      </div>
    </section>
  );
}

export default memo(KpiCards);
