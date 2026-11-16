import { memo, useMemo } from 'react';
import type { Shot } from '../../common/casting/types';
import po from '../process_optimization/ProcessOptimization.module.css';

const WINDOW = 60; // 최근 표시 샷 수
const W = 600, H = 180, L = 34, R = 8, T = 10, B = 22;

/** 실시간 1차(ML) 불량 확률 — 최근 WINDOW 샷, 판정 기준선 점선, 기준 이상 샷은 빨간 점 */
function ProbChart({ shots, threshold }: { shots: Shot[]; threshold: number }) {
  const lastId = shots.length ? shots[shots.length - 1].shotId : 0;
  const view = useMemo(() => shots.slice(-WINDOW), [shots, lastId]);
  const x = (i: number) => L + (i / Math.max(WINDOW - 1, 1)) * (W - L - R);
  const y = (p: number) => T + (1 - p) * (H - T - B);
  const path = useMemo(
    () => view.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.prob).toFixed(1)}`).join(''),
    [view],
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={po.chart} role="img"
      aria-label={`최근 ${view.length}샷 불량 확률 추이, 판정 기준 ${threshold}`}>
      {[0, 0.5, 1].map(p => (
        <g key={p}>
          <line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke="var(--line)" />
          <text x={L - 6} y={y(p) + 3} textAnchor="end">{p}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(threshold)} y2={y(threshold)} stroke="var(--bad)" strokeDasharray="4 3" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      {view.map((d, i) => d.prob >= threshold && (
        <circle key={d.shotId} cx={x(i)} cy={y(d.prob)} r="3.5" fill="var(--bad)" />
      ))}
      {view.length > 0 && (
        <>
          <text x={L} y={H - 6}>#{view[0].shotId}</text>
          <text x={W - R} y={H - 6} textAnchor="end">#{view[view.length - 1].shotId}</text>
        </>
      )}
    </svg>
  );
}

export default memo(ProbChart);
