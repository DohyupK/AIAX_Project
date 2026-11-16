import { LABELS, MONITOR_GROUPS, fmt, severity, unitOf } from '../../common/casting/analysis';
import type { FeatureKey, ModelInfo, Shot } from '../../common/casting/types';
import s from './ProcessOptimization.module.css';

const STATUS = { ok: '정상', warn: '주의', bad: '이탈', na: '결측' } as const;
const TREND = 30;                 // 추이 그래프 샷 수
const SW = 150, SH = 30;          // 추이 그래프 viewBox
export const SENSOR_MONITOR_ID = 'sensor-monitor'; // 장면 라벨 클릭 시 스크롤 목적지

/**
 * 공정 변수 모니터 (4열×3행, 공정 단계별 묶음) — 칸마다 최근 값·상태·최근 30샷 추이
 * onSelect 를 주면 칸 클릭 시 아래 관리도(SPC) 변수 선택. 없으면(품질 검사 페이지) 보기 전용
 * activeGroup: 설비 장면에서 지금 진행 중인 공정 단계 묶음 (0·1·2)
 */
export default function SensorMonitor({ shots, model, selected, onSelect, activeGroup }: {
  shots: Shot[]; model: ModelInfo; selected?: FeatureKey; onSelect?: (k: FeatureKey) => void; activeGroup?: number;
}) {
  const last = shots[shots.length - 1];
  const recent = shots.slice(-TREND);

  return (
    <section className={s.panel} id={SENSOR_MONITOR_ID}>
      <div className={s.panelHead}>
        <h3>공정 변수 모니터</h3>
        <span className={s.sub}>사이클 진행 순서 · 최근 {TREND}샷 · 음영 = 정상 범위{onSelect && ' · 칸을 누르면 관리도(SPC)에 표시'}</span>
      </div>
      <div className={s.groups}>
        {MONITOR_GROUPS.map((g, gi) => (
          <div key={g.name} className={`${s.group} ${s[`group${gi}`]} ${gi === activeGroup ? s.groupActive : ''}`}>
            <div className={s.groupHead}>
              <span className={s.groupNo}>{gi + 1}</span>
              <b>{g.name}</b>
              {gi === activeGroup && <span className={s.groupLive}>진행중</span>}
            </div>
            <div className={s.sensors}>
              {g.keys.map(k => {
                const v = last?.features[k] ?? null;
                const sev = severity(model, k, v);
                const cycle = k === 'facility_CycleTime';
                const body = (
                  <>
                    <span className={s.sensorTop}>
                      <span>{cycle ? '사이클 시간' : LABELS[k]}</span>
                      <span className={`${s.pill} ${s[`pill_${sev}`]}`}>{STATUS[sev]}</span>
                    </span>
                    <span className={`${s.sensorValue} ${s.num}`}>
                      {fmt(v)}{cycle && <> / {fmt(last?.features.production_CycleTime ?? null)}</>}
                      <small className={s.sub}> {unitOf(k)}</small>
                      {cycle && <small className={s.cycleLegend}>— 설비 ┄ 생산</small>}
                    </span>
                    <Spark shots={recent} model={model} k={k} extra={cycle ? 'production_CycleTime' : undefined} />
                  </>
                );
                const cls = `${s.sensor} ${s[`sensor_${sev}`]}`;
                return onSelect ? (
                  <button key={k} type="button" aria-pressed={k === selected} onClick={() => onSelect(k)}
                    aria-label={`${LABELS[k]} ${fmt(v)} ${unitOf(k)} ${STATUS[sev]} — 관리도 보기`}
                    className={`${cls} ${k === selected ? s.sensorSelected : ''}`}>{body}</button>
                ) : (
                  <div key={k} className={cls}>{body}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 최근 샷 추이 — 음영 = 정상 범위(p5~p95), 주의·이탈 점 표시. extra = 점선으로 함께 그릴 변수 */
function Spark({ shots, model, k, extra }: { shots: Shot[]; model: ModelInfo; k: FeatureKey; extra?: FeatureKey }) {
  const [lo, mid, hi] = model.bands[k];
  const keys = extra ? [k, extra] : [k];
  const vals = keys.flatMap(key => shots.map(x => x.features[key])).filter((v): v is number => v != null);
  const min = Math.min(lo, ...vals), max = Math.max(hi, ...vals), pad = (max - min) * 0.08 || 1;
  const X = (i: number) => 2 + (i * (SW - 4)) / Math.max(1, TREND - 1);
  const Y = (v: number) => 2 + ((max + pad - v) / (max - min + 2 * pad)) * (SH - 4);
  const line = (key: FeatureKey) => shots.map((x, i) => { const v = x.features[key]; return v == null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`; }).filter(Boolean).join(' ');

  return (
    <svg className={s.spark} viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y={Y(hi)} width={SW} height={Math.max(0.5, Y(lo) - Y(hi))} className={s.sparkBand} />
      <line x1="0" x2={SW} y1={Y(mid)} y2={Y(mid)} className={s.sparkMid} vectorEffect="non-scaling-stroke" />
      {extra && <polyline points={line(extra)} className={`${s.sparkLine} ${s.sparkDash}`} vectorEffect="non-scaling-stroke" />}
      <polyline points={line(k)} className={s.sparkLine} vectorEffect="non-scaling-stroke" />
      {shots.map((x, i) => {
        const v = x.features[k];
        const sev = severity(model, k, v);
        return v != null && sev !== 'ok'
          ? <rect key={x.shotId} x={X(i) - 1.6} y={Y(v) - 1.6} width="3.2" height="3.2" className={sev === 'bad' ? s.sparkBad : s.sparkWarn} />
          : null;
      })}
    </svg>
  );
}
