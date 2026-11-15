import { LABELS, MONITOR_KEYS, fmt, severity, unitOf } from '../../common/casting/analysis';
import type { FeatureKey, ModelInfo, Shot } from '../../common/casting/types';
import s from './ProcessOptimization.module.css';

const STATUS = { ok: '정상', warn: '주의', bad: '이탈', na: '결측' } as const;

/**
 * 공정 변수 모니터 (4×2) — onSelect 를 주면 칸 클릭 시 아래 관리도(SPC) 변수 선택
 * onSelect 없이 쓰면(품질 검사 페이지) 보기 전용
 */
export default function SensorMonitor({ shots, model, selected, onSelect }: {
  shots: Shot[]; model: ModelInfo; selected?: FeatureKey; onSelect?: (k: FeatureKey) => void;
}) {
  const last = shots[shots.length - 1];

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <h3>공정 변수 모니터</h3>
        <span className={s.sub}>최근 샷 값{onSelect && ' · 칸을 누르면 관리도(SPC)에 표시'}</span>
      </div>
      <div className={s.sensors}>
        {MONITOR_KEYS.map(k => {
          const v = last?.features[k] ?? null;
          const [lo, , hi] = model.bands[k];
          const sev = severity(model, k, v);
          const body = (
            <>
              <span className={s.sensorTop}>
                <span>{LABELS[k]}</span>
                <span className={`${s.pill} ${s[`pill_${sev}`]}`}>{STATUS[sev]}</span>
              </span>
              <span className={`${s.sensorValue} ${s.num}`}>{fmt(v)}<small className={s.sub}> {unitOf(k)}</small></span>
              <span className={`${s.sub} ${s.num}`}>정상 {fmt(lo)} – {fmt(hi)}</span>
            </>
          );
          const cls = `${s.sensor} ${s[`sensor_${sev}`]}`;
          return onSelect ? (
            <button key={k} type="button" aria-pressed={k === selected} onClick={() => onSelect(k)}
              className={`${cls} ${k === selected ? s.sensorSelected : ''}`}>{body}</button>
          ) : (
            <div key={k} className={cls}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}
