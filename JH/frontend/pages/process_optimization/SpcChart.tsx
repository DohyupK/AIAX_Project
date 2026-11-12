import { useState } from 'react';
import {
  EWMA_L, EWMA_LAMBDA, LABELS, NELSON_TEXT, SPC_BASELINE,
  ewmaLimits, ewmaSeries, fmt, isThermal, nelsonFlags, spcLimits, unitOf,
} from '../../common/casting/analysis';
import type { FeatureKey, Shot } from '../../common/casting/types';
import s from './ProcessOptimization.module.css';

const WINDOW = 50;                      // 최근 표시 샷 수
const W = 760, H = 260;
const L = 48, R = 96, T = 16, B = 28;   // 여백 (오른쪽은 UCL/CL/LCL 값 표시 자리)
const TIP_W = 200;

/**
 * 관리도(SPC) — 한계는 그날 처음 SPC_BASELINE샷으로 고정
 * 온도 변수: EWMA 관리도 (σ = 기준 구간 전체 표준편차), 한계 밖만 판정 (EWMA는 값끼리 상관이 있어 연속 규칙 미적용)
 * 그 외(압력·사이클): 개별값 관리도(I-MR) + Nelson 규칙 1·2·3
 */
export default function SpcChart({ shots, k }: { shots: Shot[]; k: FeatureKey }) {
  const [hover, setHover] = useState<number | null>(null);
  const all = shots
    .map(x => ({ id: x.shotId, time: x.time, v: x.features[k] }))
    .filter((p): p is { id: number; time: string; v: number } => p.v != null); // 결측 샷 제외
  const thermal = isThermal(k);
  const baseline = all.slice(0, SPC_BASELINE).map(p => p.v);
  const lim = thermal ? ewmaLimits(baseline) : spcLimits(baseline);

  if (!lim) {
    return (
      <section className={s.panel}>
        <div className={s.panelHead}><h3>관리도(SPC) · {LABELS[k]}</h3></div>
        <p className={s.sub}>표시할 데이터가 없습니다.</p>
      </section>
    );
  }

  // 판정은 전체 샷으로 해야 화면 경계에 걸친 연속 구간·EWMA 누적값이 맞음
  const raw = all.map(p => p.v);
  const plotted = thermal ? ewmaSeries(raw, lim.cl) : raw;
  const rules: string[][] = thermal
    ? plotted.map(z => (z > lim.ucl || z < lim.lcl ? ['EWMA 관리 한계 밖'] : []))
    : nelsonFlags(raw, lim).map(f => f.map(r => NELSON_TEXT[r]));
  const start = Math.max(0, all.length - WINDOW);
  const pts = all.slice(start).map((p, i) => ({ ...p, y: plotted[start + i], rules: rules[start + i] }));

  const vals = pts.map(p => p.y);
  const lo = Math.min(lim.lcl, ...vals), hi = Math.max(lim.ucl, ...vals);
  const pad = (hi - lo) * 0.08 || 1;
  const y = (v: number) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const x = (i: number) => L + (pts.length > 1 ? (i / (pts.length - 1)) * (W - L - R) : (W - L - R) / 2);
  const hp = hover != null ? pts[hover] : null;
  const unit = unitOf(k);
  const lines = [
    { name: 'UCL', v: lim.ucl, cls: s.limitText, dash: undefined, color: 'var(--bad)' },
    { name: 'CL', v: lim.cl, cls: s.clText, dash: '5 4', color: 'var(--muted)' },
    { name: 'LCL', v: lim.lcl, cls: s.limitText, dash: undefined, color: 'var(--bad)' },
  ];

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <h3>관리도(SPC) · {LABELS[k]}</h3>
        <span className={s.sub}>
          최근 {pts.length}샷 · 처음 {Math.min(all.length, SPC_BASELINE)}샷 기준 ·{' '}
          {thermal ? `EWMA (λ=${EWMA_LAMBDA}, L=${EWMA_L}, σ=전체 표준편차)` : 'I-MR · Nelson 규칙 1·2·3'}
        </span>
      </div>
      <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${LABELS[k]} ${thermal ? 'EWMA ' : ''}관리도, UCL ${fmt(lim.ucl)}, CL ${fmt(lim.cl)}, LCL ${fmt(lim.lcl)}`}>
        {/* UCL·LCL 실선, CL 점선 + 값 */}
        {lines.map(l => (
          <g key={l.name}>
            <line x1={L} x2={W - R} y1={y(l.v)} y2={y(l.v)} stroke={l.color} strokeWidth={1.5} strokeDasharray={l.dash} />
            <text x={W - R + 6} y={y(l.v) + 4} className={l.cls}>{l.name} {fmt(l.v)}</text>
          </g>
        ))}
        <text x={L - 6} y={T + 8} textAnchor="end">{fmt(hi)}</text>
        <text x={L - 6} y={H - B} textAnchor="end">{fmt(lo)}</text>
        <text x={L} y={H - 8}>#{pts[0].id}</text>
        <text x={W - R} y={H - 8} textAnchor="end">#{pts[pts.length - 1].id}</text>

        <polyline fill="none" stroke="var(--accent)" strokeWidth={1.5}
          points={pts.map((p, i) => `${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')} />
        {pts.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.y)} r={hover === i ? 5 : 3.5}
            fill={p.rules.length ? 'var(--bad)' : 'var(--accent)'} stroke="var(--panel)" strokeWidth={1}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}

        {/* 마우스 올린 점의 실제 값 + 위반 규칙 */}
        {hp && (() => {
          const base = thermal ? 48 : 34;
          const h = base + hp.rules.length * 14;
          const tx = Math.min(Math.max(x(hover!) - TIP_W / 2, L), W - R - TIP_W);
          const ty = y(hp.y) > T + h + 12 ? y(hp.y) - h - 12 : y(hp.y) + 12;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TIP_W} height={h} rx={4} fill="var(--ink)" opacity={0.9} />
              <text x={tx + 8} y={ty + 14} className={s.tipText}>#{hp.id} · {hp.time}</text>
              <text x={tx + 8} y={ty + 28} className={s.tipText}>{thermal ? `실측 ${LABELS[k]}` : LABELS[k]} {fmt(hp.v)}{unit && ` ${unit}`}</text>
              {thermal && <text x={tx + 8} y={ty + 42} className={s.tipText}>EWMA {fmt(hp.y)}{unit && ` ${unit}`}</text>}
              {hp.rules.map((r, j) => (
                <text key={r} x={tx + 8} y={ty + base + 8 + j * 14} className={s.tipRule}>{r}</text>
              ))}
            </g>
          );
        })()}
      </svg>
    </section>
  );
}
