import { LABELS, MONITOR_GROUPS, fmt, severity, unitOf } from '../../common/casting/analysis';
import type { FeatureKey, ModelInfo, Shot } from '../../common/casting/types';
import { BADGE, CARD, CARD_HEAD, CARD_TITLE, FOCUS, SUB, TONE } from '../../common/ui';

const STATUS = { ok: '정상', warn: '주의', bad: '이탈', na: '결측' } as const;
const STATUS_TONE = { ok: TONE.ok, warn: TONE.warn, bad: TONE.bad, na: TONE.warn } as const;
const TREND = 30;                 // 추이 그래프 샷 수
const SW = 150, SH = 30;          // 추이 그래프 viewBox
export const SENSOR_MONITOR_ID = 'sensor-monitor'; // 장면 라벨 클릭 시 스크롤 목적지
// 공정 단계 묶음 머리 색 (설비 장면 단계 색과 같은 계열)
const GROUP_LINE = ['border-red-400', 'border-yellow-500', 'border-sky-500'];

/**
 * 공정 변수 모니터 (공정 단계별 묶음) — 칸마다 최근 값·상태·최근 30샷 추이
 * PC(1181px+): 1열 · 1열 · 2열 묶음 / 1180 이하: 묶음 세로, 칸 3열 / 860 이하: 칸 2열
 * onSelect 를 주면 칸 클릭 시 아래 관리도(SPC) 변수 선택. 없으면(품질 검사 페이지) 보기 전용
 * activeGroup: 설비 장면에서 지금 진행 중인 공정 단계 묶음 (0·1·2)
 */
export default function SensorMonitor({ shots, model, selected, onSelect, activeGroup }: {
  shots: Shot[]; model: ModelInfo; selected?: FeatureKey; onSelect?: (k: FeatureKey) => void; activeGroup?: number;
}) {
  const last = shots[shots.length - 1];
  const recent = shots.slice(-TREND);

  return (
    <section className={`${CARD} scroll-mt-20`} id={SENSOR_MONITOR_ID}>
      <header className={CARD_HEAD}>
        <h2 className={CARD_TITLE}>공정 변수 모니터</h2>
        <span className={SUB}>사이클 진행 순서 · 최근 {TREND}샷 · 음영 = 정상 범위{onSelect && ' · 칸을 누르면 관리도(SPC)에 표시'}</span>
      </header>
      <div className="grid gap-4 p-5 phone:p-3 min-[1181px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
        {MONITOR_GROUPS.map((g, gi) => (
          <div key={g.name} className={`flex min-w-0 flex-col gap-2 rounded-xl p-2 transition-colors ${gi === activeGroup ? 'bg-gray-50 dark:bg-gray-700/30' : ''}`}>
            <div className={`flex items-center gap-2 border-t-4 px-1 pt-2 text-sm ${GROUP_LINE[gi]}`}>
              <span className="grid size-5 place-items-center rounded-md border border-gray-200 font-mono text-[11px] text-gray-500 dark:border-gray-700/60 dark:text-gray-400">{gi + 1}</span>
              <b className="font-semibold text-gray-800 dark:text-gray-100">{g.name}</b>
              {gi === activeGroup && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-600 dark:text-yellow-500">
                  <span className="size-2 rounded-full bg-yellow-500" />진행중
                </span>
              )}
            </div>
            <div className={`grid grid-cols-3 gap-2.5 tablet:grid-cols-2 ${gi === 2 ? 'min-[1181px]:grid-cols-2' : 'min-[1181px]:grid-cols-1'}`}>
              {g.keys.map(k => {
                const v = last?.features[k] ?? null;
                const sev = severity(model, k, v);
                const cycle = k === 'facility_CycleTime';
                const body = (
                  <>
                    <span className="flex items-center justify-between gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="truncate">{cycle ? '사이클 시간' : LABELS[k]}</span>
                      <span className={`${BADGE} ${STATUS_TONE[sev]}`}>{STATUS[sev]}</span>
                    </span>
                    <span className="text-xl font-semibold tabular-nums text-gray-800 dark:text-gray-100 phone:text-lg">
                      {fmt(v)}{cycle && <> / {fmt(last?.features.production_CycleTime ?? null)}</>}
                      <small className="ml-1 text-xs font-medium text-gray-400 dark:text-gray-500">{unitOf(k)}</small>
                      {cycle && <small className="ml-2 font-mono text-[11px] font-normal text-gray-400 dark:text-gray-500">— 설비 ┄ 생산</small>}
                    </span>
                    <Spark shots={recent} model={model} k={k} extra={cycle ? 'production_CycleTime' : undefined} />
                  </>
                );
                // 이탈 칸은 옅은 빨간 바탕
                const cls = `flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-left phone:p-2.5 ${
                  sev === 'bad'
                    ? 'border-red-300 bg-red-500/5 dark:border-red-500/50'
                    : 'border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800'
                }`;
                return onSelect ? (
                  <button key={k} type="button" aria-pressed={k === selected} onClick={() => onSelect(k)}
                    aria-label={`${LABELS[k]} ${fmt(v)} ${unitOf(k)} ${STATUS[sev]} — 관리도 보기`}
                    className={`${cls} cursor-pointer transition hover:border-gray-300 dark:hover:border-gray-600 ${FOCUS} ${
                      k === selected ? 'ring-2 ring-brand-500 dark:ring-brand-400' : ''
                    }`}>{body}</button>
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
    <svg className="mt-0.5 block h-[30px] w-full" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y={Y(hi)} width={SW} height={Math.max(0.5, Y(lo) - Y(hi))} className="fill-green-500/15" />
      <line x1="0" x2={SW} y1={Y(mid)} y2={Y(mid)} className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      {extra && <polyline points={line(extra)} fill="none" strokeWidth={1.3} strokeDasharray="3 3" className="stroke-brand-500 dark:stroke-brand-400" vectorEffect="non-scaling-stroke" />}
      <polyline points={line(k)} fill="none" strokeWidth={1.3} className="stroke-gray-500 dark:stroke-gray-400" vectorEffect="non-scaling-stroke" />
      {shots.map((x, i) => {
        const v = x.features[k];
        const sev = severity(model, k, v);
        return v != null && sev !== 'ok'
          ? <rect key={i} x={X(i) - 1.6} y={Y(v) - 1.6} width="3.2" height="3.2" className={sev === 'bad' ? 'fill-red-500' : 'fill-yellow-500'} />
          : null;
      })}
    </svg>
  );
}
