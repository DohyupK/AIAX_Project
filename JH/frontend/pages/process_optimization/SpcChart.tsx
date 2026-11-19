'use client';
import { memo, useMemo, useState } from 'react';
import { EWMA_LAMBDA, LABELS, NELSON_TEXT, ewmaSeries, fmt, nelsonFlags, unitOf } from '../../common/casting/analysis';
import { spcBaseline } from '../../common/casting/spcLimits';
import type { FeatureKey, Shot } from '../../common/casting/types';
import s from './ProcessOptimization.module.css';

const WINDOW = 100;              // 최근 표시 샷 수 (약 4시간)
const W = 620;                   // 세 그래프 공통 가로 (오른쪽 여백 = 관리선 값 표시 자리)
const L = 44, R = 86, T = 10, B = 22;
const TIP_W = 210;

/** 점 표시 — warn: ▲ 주의(규칙 1, I 관리선 밖) / watch: ◆ 관찰(규칙 2·3, MR·EWMA 관리선 밖) */
type Mark = { text: string; kind: 'warn' | 'watch' };
type Pt = { id: number; time: string; min: number; v: number };
type PlotPt = Pt & { y: number; marks: Mark[] };
type Lines = { cl: number; ucl: number; lcl: number };

/** 'H:mm:ss' → 하루 안 분 (가로축 = 시각) */
const toMin = (t: string) => { const [h, m, sec] = t.split(':').map(Number); return h * 60 + m + (sec || 0) / 60; };

/**
 * 관리도(SPC) — 왼쪽 위 I 관리도, 왼쪽 아래 MR 관리도, 오른쪽 EWMA 관리도
 * 기준선 = 라인별·변수별 고정 표(spcLimits.ts, 날짜 무관). CL 실선, UCL·LCL 점선
 * I: Nelson 규칙 1(관리선 밖) = ▲ 주의, 규칙 2·3(연속 패턴) = ◆ 관찰 / MR·EWMA 관리선 밖 = ◆ 관찰
 * EWMA 는 조회 구간 첫 샷을 CL 에서 시작 (값끼리 상관이 있어 연속 규칙 미적용)
 * 성능: 판정 계산은 shots·변수·라인이 바뀔 때만 (useMemo), 컴포넌트는 memo
 */
function SpcChart({ shots, k, line }: { shots: Shot[]; k: FeatureKey; line: string }) {
  const base = useMemo(() => spcBaseline(line, k), [line, k]); // 같은 객체 유지 → 아래 판정 계산이 매 렌더 다시 돌지 않게
  const calc = useMemo(() => {
    if (!base) return null;
    const all = shots
      .map(x => ({ id: x.shotId, time: x.time, min: toMin(x.time), v: x.features[k] }))
      .filter((p): p is Pt => p.v != null); // 빈 값(결측) 샷은 판정 제외
    // 판정은 전체 샷으로 해야 화면 경계에 걸친 연속 구간·EWMA 누적값이 맞음
    const raw = all.map(p => p.v);
    const start = Math.max(0, all.length - WINDOW);
    const plot = (ys: number[], marks: Mark[][], from = start): PlotPt[] =>
      all.slice(from).map((p, i) => ({ ...p, y: ys[from + i], marks: marks[from + i] }));

    const iLines = { cl: base.cl, ucl: base.iUcl, lcl: base.iLcl };
    const iPts = plot(raw, nelsonFlags(raw, iLines).map(f => f.map(r => ({ text: NELSON_TEXT[r], kind: r === 1 ? 'warn' : 'watch' }) as Mark)));
    // MR_i = |x_i − x_(i−1)| — 첫 샷은 MR 없음
    const mr = raw.map((v, i) => (i ? Math.abs(v - raw[i - 1]) : NaN));
    const mrPts = plot(mr, mr.map(m => (m > base.mrUcl ? [{ text: 'MR 관리선 밖 (샷 간 변동 큼)', kind: 'watch' }] : [])), Math.max(1, start));
    const ewma = ewmaSeries(raw, base.cl);
    const ewPts = plot(ewma, ewma.map(z => (z > base.ewmaUcl || z < base.ewmaLcl ? [{ text: 'EWMA 관리선 밖 (평균 이동)', kind: 'watch' }] : [])));
    return { n: all.length, iPts, mrPts, ewPts };
  }, [shots, k, base]);

  const head = (
    <div className={s.panelHead}>
      <h3>관리도(SPC) · {LABELS[k]}</h3>
      {calc && calc.n > 0 && <span className={s.sub}>{line} 기준선 · 최근 {Math.min(calc.n, WINDOW)}샷</span>}
    </div>
  );
  if (!base) return <section className={s.panel}>{head}<p className={s.sub}>{line} · {LABELS[k]} 는 관리도 기준선이 없습니다.</p></section>;
  if (!calc || calc.iPts.length < 2) return <section className={s.panel}>{head}<p className={s.sub}>표시할 데이터가 없습니다.</p></section>;

  const { iPts, mrPts, ewPts } = calc;
  return (
    <section className={s.panel}>
      {head}
      <div className={s.spcGrid}>
        <ControlChart k={k} pts={iPts} h={250} dots className={s.spcI}
          lines={{ cl: base.cl, ucl: base.iUcl, lcl: base.iLcl }}
          title="I 관리도" note={`CL ${fmt(base.cl)} · 관리선 ${fmt(base.iLcl)} ~ ${fmt(base.iUcl)} (CL ± 3σ)`} />
        <ControlChart k={k} pts={mrPts} h={150} dots className={s.spcMr} valueLabel="MR"
          lines={{ cl: base.mrCl, ucl: base.mrUcl, lcl: 0 }}
          title="MR 관리도" note={`MR̄ ${fmt(base.mrCl)} · UCL ${fmt(base.mrUcl)} (3.267 × MR̄)`} />
        <ControlChart k={k} pts={ewPts} h={430} className={s.spcEw} valueLabel="EWMA"
          lines={{ cl: base.cl, ucl: base.ewmaUcl, lcl: base.ewmaLcl }}
          title="EWMA 관리도" note={`λ ${EWMA_LAMBDA} · 관리선 ${fmt(base.ewmaLcl)} ~ ${fmt(base.ewmaUcl)} (CL ± 1σ) · 조회 구간마다 CL에서 시작`} />
      </div>
      <p className={s.spcLegend}>
        <span><i className={s.lgDot} />판정 샷</span>
        <span><i className={s.lgWarn} />주의 (규칙 1: I 관리선 밖)</span>
        <span><i className={s.lgWatch} />관찰 (규칙 2·3, MR·EWMA 관리선 밖)</span>
        <span><i className={s.lgCl} />중심선</span>
        <span><i className={s.lgLimit} />관리선</span>
        <span>빈 값 샷은 판정 제외 · σ = MR̄ / 1.128</span>
      </p>
    </section>
  );
}

/** 관리도 1개 — CL 실선, UCL·LCL 점선, 가로축 시각, ▲ 주의 · ◆ 관찰, 마우스 올리면 상세 */
function ControlChart({ k, pts, lines, h, title, note, className, dots = false, valueLabel }: {
  k: FeatureKey; pts: PlotPt[]; lines: Lines; h: number; title: string; note: string; className: string;
  dots?: boolean; valueLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = pts.map(p => p.y);
  const lo = Math.min(lines.lcl, ...vals), hi = Math.max(lines.ucl, ...vals);
  const pad = (hi - lo) * 0.06 || 1;
  const y = (v: number) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (h - T - B);
  const t0 = pts[0].min, t1 = pts[pts.length - 1].min;
  const x = (m: number) => L + (t1 > t0 ? ((m - t0) / (t1 - t0)) * (W - L - R) : (W - L - R) / 2);
  // 가로 눈금: 30분 단위 (4시간 넘으면 1시간)
  const step = t1 - t0 > 240 ? 60 : 30;
  const ticks: number[] = [];
  for (let m = Math.ceil(t0 / step) * step; m <= t1; m += step) ticks.push(m);
  const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  const yTicks = [lo - pad, (lo + hi) / 2, hi + pad];
  const hp = hover != null ? pts[hover] : null;
  const unit = unitOf(k);
  const marked = pts.filter(p => p.marks.length).length;
  const guides = [
    { name: 'UCL', v: lines.ucl, dash: '6 4' },
    { name: 'CL', v: lines.cl, dash: undefined },
    { name: 'LCL', v: lines.lcl, dash: '6 4' },
  ];

  return (
    <figure className={`${s.spcBox} ${className}`}>
      <figcaption className={s.spcCaption}>
        <b>{title}</b>
        <span className={s.sub}>{note}{marked > 0 && <> · 표시 <b className={s.spcTrend}>{marked}</b>점</>}</span>
      </figcaption>
      <svg className={s.chart} viewBox={`0 0 ${W} ${h}`} role="img"
        aria-label={`${LABELS[k]} ${title}, UCL ${fmt(lines.ucl)}, CL ${fmt(lines.cl)}, LCL ${fmt(lines.lcl)}, 표시 ${marked}점`}>
        {ticks.map(m => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1={T} y2={h - B} stroke="var(--line)" strokeWidth={0.6} />
            <text x={x(m)} y={h - 6} textAnchor="middle">{hhmm(m)}</text>
          </g>
        ))}
        {yTicks.map((v, i) => <text key={i} x={L - 6} y={y(v) + 3} textAnchor="end">{fmt(v)}</text>)}
        {guides.map(g => (
          <g key={g.name}>
            <line x1={L} x2={W - R} y1={y(g.v)} y2={y(g.v)} stroke={g.dash ? 'var(--muted)' : 'var(--ink)'}
              strokeOpacity={g.dash ? 0.9 : 0.55} strokeWidth={1.2} strokeDasharray={g.dash} />
            <text x={W - R + 6} y={y(g.v) + 3} className={s.clText}>{g.name} {fmt(g.v)}</text>
          </g>
        ))}

        <polyline fill="none" stroke={dots ? 'var(--ink)' : 'var(--accent)'} strokeOpacity={dots ? 0.75 : 1} strokeWidth={dots ? 1.1 : 1.6}
          points={pts.map(p => `${x(p.min).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')} />
        {pts.map((p, i) => {
          const cx = x(p.min), cy = y(p.y);
          const warn = p.marks.some(m => m.kind === 'warn');
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* 마우스 감지용 투명 원 (점이 없는 EWMA 도 상세 보기) */}
              <circle cx={cx} cy={cy} r={6} fill="transparent" />
              {dots && <circle cx={cx} cy={cy} r={hover === i ? 3.6 : 2.2} fill="var(--ink)" fillOpacity={0.8} />}
              {warn
                ? <path d={`M${cx} ${cy + 5} l5 9 h-10 z`} fill="#e8743b" />
                : p.marks.length > 0 && <path d={`M${cx} ${cy - 5} l5 5 -5 5 -5 -5 z`} fill="var(--accent)" />}
            </g>
          );
        })}

        {hp && (() => {
          const lines2 = valueLabel ? 3 : 2;
          const bh = 6 + lines2 * 14 + hp.marks.length * 14;
          const tx = Math.min(Math.max(x(hp.min) - TIP_W / 2, L), W - R - TIP_W);
          const ty = y(hp.y) > T + bh + 10 ? y(hp.y) - bh - 10 : y(hp.y) + 10;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TIP_W} height={bh} rx={4} fill="var(--ink)" opacity={0.9} />
              <text x={tx + 8} y={ty + 14} className={s.tipText}>#{hp.id} · {hp.time}</text>
              <text x={tx + 8} y={ty + 28} className={s.tipText}>{LABELS[k]} {fmt(hp.v)}{unit && ` ${unit}`}</text>
              {valueLabel && <text x={tx + 8} y={ty + 42} className={s.tipText}>{valueLabel} {fmt(hp.y)}</text>}
              {hp.marks.map((m, j) => (
                <text key={m.text} x={tx + 8} y={ty + 6 + (lines2 + j + 1) * 14 - 6} className={m.kind === 'warn' ? s.tipRule : s.tipTrend}>{m.text}</text>
              ))}
            </g>
          );
        })()}
      </svg>
    </figure>
  );
}

export default memo(SpcChart);
