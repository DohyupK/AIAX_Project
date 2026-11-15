import { useState } from 'react';
import {
  EWMA_L, EWMA_LAMBDA, LABELS, NELSON_TEXT, SPC_BASELINE,
  ewmaLimits, ewmaSeries, fmt, nelsonFlags, spcLimits, unitOf,
  type SpcLimits,
} from '../../common/casting/analysis';
import type { FeatureKey, Shot } from '../../common/casting/types';
import s from './ProcessOptimization.module.css';

const WINDOW = 50;                      // 최근 표시 샷 수
const W = 540, H = 260;                 // 그래프 2개가 나란히 들어가는 크기
const L = 44, R = 92, T = 16, B = 28;   // 여백 (오른쪽은 UCL/CL/LCL 값 표시 자리)
const TIP_W = 200;

type Pt = { id: number; time: string; v: number };
/** 판정 1건 — bad: 한계 밖(빨강, 즉시 조치) / 아니면 추세 경고(주황, 평균 이동·연속 패턴) */
type Rule = { text: string; bad: boolean };
type PlotPt = Pt & { y: number; rules: Rule[] };

/**
 * 관리도(SPC) 2개 — 모든 변수 공통, 한계는 둘 다 그날 처음 SPC_BASELINE샷으로 고정
 * 왼쪽(큰 변화): 개별값 관리도 I-MR + Nelson 규칙 — 규칙 1(한계 밖) = 빨강, 규칙 2·3(연속 패턴) = 주황
 * 오른쪽(작은 추세): EWMA 관리도 — EWMA 한계 밖(평균 이동) = 주황, 실측값이 I-MR 한계 밖 = 빨강
 *   (EWMA는 값끼리 상관이 있어 연속 규칙 미적용)
 * 참고: 온도는 샷 간 자기상관이 커서 I-MR 한계가 좁게 잡혀 신호가 많을 수 있음 (계산 오류 아님)
 */
export default function SpcChart({ shots, k }: { shots: Shot[]; k: FeatureKey }) {
  const all = shots
    .map(x => ({ id: x.shotId, time: x.time, v: x.features[k] }))
    .filter((p): p is Pt => p.v != null); // 결측 샷 제외
  const baseline = all.slice(0, SPC_BASELINE).map(p => p.v);
  const imr = spcLimits(baseline);
  const ew = ewmaLimits(baseline);

  const head = (
    <div className={s.panelHead}>
      <h3>관리도(SPC) · {LABELS[k]}</h3>
      {imr && ew && <span className={s.sub}>최근 {Math.min(all.length, WINDOW)}샷 · 두 그래프 모두 처음 {Math.min(all.length, SPC_BASELINE)}샷 기준</span>}
    </div>
  );
  if (!imr || !ew) {
    return <section className={s.panel}>{head}<p className={s.sub}>표시할 데이터가 없습니다.</p></section>;
  }

  // 판정은 전체 샷으로 해야 화면 경계에 걸친 연속 구간·EWMA 누적값이 맞음
  const raw = all.map(p => p.v);
  const start = Math.max(0, all.length - WINDOW);
  const toPlot = (ys: number[], rules: Rule[][]): PlotPt[] =>
    all.slice(start).map((p, i) => ({ ...p, y: ys[start + i], rules: rules[start + i] }));

  const imrPts = toPlot(raw, nelsonFlags(raw, imr).map(f => f.map(r => ({ text: NELSON_TEXT[r], bad: r === 1 }))));
  const ewma = ewmaSeries(raw, ew.cl);
  const ewmaPts = toPlot(ewma, ewma.map((z, i) => [
    ...(raw[i] > imr.ucl || raw[i] < imr.lcl ? [{ text: '실측값 I-MR 한계 밖', bad: true }] : []),
    ...(z > ew.ucl || z < ew.lcl ? [{ text: 'EWMA 추세 이동 (평균 변화)', bad: false }] : []),
  ]));

  return (
    <section className={s.panel}>
      {head}
      <div className={s.spcPair}>
        <ControlChart k={k} pts={imrPts} lim={imr}
          title="개별값 관리도 · I-MR · Nelson 규칙 1·2·3" note="CL ± 2.66·MR̄" />
        <ControlChart k={k} pts={ewmaPts} lim={ew} ewma
          title="추세 관리도 · EWMA" note={`λ=${EWMA_LAMBDA}, L=${EWMA_L}, σ=기준 구간 표준편차`} />
      </div>
    </section>
  );
}

/** 관리도 1개 — UCL·LCL 실선, CL 점선, 한계 밖 점 빨강 · 추세 경고 점 주황, 마우스 올리면 상세 */
function ControlChart({ k, pts, lim, title, note, ewma = false }: {
  k: FeatureKey; pts: PlotPt[]; lim: SpcLimits; title: string; note: string; ewma?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = pts.map(p => p.y);
  const lo = Math.min(lim.lcl, ...vals), hi = Math.max(lim.ucl, ...vals);
  const pad = (hi - lo) * 0.08 || 1;
  const y = (v: number) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const x = (i: number) => L + (pts.length > 1 ? (i / (pts.length - 1)) * (W - L - R) : (W - L - R) / 2);
  const hp = hover != null ? pts[hover] : null;
  const unit = unitOf(k);
  const isBad = (p: PlotPt) => p.rules.some(r => r.bad);
  const outCount = pts.filter(isBad).length;
  const trendCount = pts.filter(p => p.rules.length && !isBad(p)).length;
  const lines = [
    { name: 'UCL', v: lim.ucl, cls: s.limitText, dash: undefined, color: 'var(--bad)' },
    { name: 'CL', v: lim.cl, cls: s.clText, dash: '5 4', color: 'var(--muted)' },
    { name: 'LCL', v: lim.lcl, cls: s.limitText, dash: undefined, color: 'var(--bad)' },
  ];

  return (
    <figure className={s.spcBox}>
      <figcaption className={s.spcCaption}>
        <b>{title}</b>
        <span className={s.sub}>
          {note} · <span className={s.dotBad} />한계 밖 <b className={outCount ? s.spcOut : undefined}>{outCount}</b>
          {' '}· <span className={s.dotWarn} />추세 경고 <b className={trendCount ? s.spcTrend : undefined}>{trendCount}</b>
        </span>
      </figcaption>
      <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${LABELS[k]} ${title}, UCL ${fmt(lim.ucl)}, CL ${fmt(lim.cl)}, LCL ${fmt(lim.lcl)}, 한계 밖 ${outCount}점, 추세 경고 ${trendCount}점`}>
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
            fill={isBad(p) ? 'var(--bad)' : p.rules.length ? 'var(--warn)' : 'var(--accent)'} stroke="var(--panel)" strokeWidth={1}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}

        {/* 마우스 올린 점의 실제 값 + 위반 규칙 */}
        {hp && (() => {
          const base = ewma ? 48 : 34;
          const h = base + hp.rules.length * 14;
          const tx = Math.min(Math.max(x(hover!) - TIP_W / 2, L), W - R - TIP_W);
          const ty = y(hp.y) > T + h + 12 ? y(hp.y) - h - 12 : y(hp.y) + 12;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TIP_W} height={h} rx={4} fill="var(--ink)" opacity={0.9} />
              <text x={tx + 8} y={ty + 14} className={s.tipText}>#{hp.id} · {hp.time}</text>
              <text x={tx + 8} y={ty + 28} className={s.tipText}>{ewma ? `실측 ${LABELS[k]}` : LABELS[k]} {fmt(hp.v)}{unit && ` ${unit}`}</text>
              {ewma && <text x={tx + 8} y={ty + 42} className={s.tipText}>EWMA {fmt(hp.y)}{unit && ` ${unit}`}</text>}
              {hp.rules.map((r, j) => (
                <text key={r.text} x={tx + 8} y={ty + base + 8 + j * 14} className={r.bad ? s.tipRule : s.tipTrend}>{r.text}</text>
              ))}
            </g>
          );
        })()}
      </svg>
    </figure>
  );
}
