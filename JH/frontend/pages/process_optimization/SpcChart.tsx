'use client';
import { memo, useEffect, useState } from 'react';
import { LABELS, fmt, unitOf } from '../../common/casting/analysis';
import { fetchSpc, type SpcData, type SpcPoint } from '../../common/casting/api';
import type { FeatureKey, Shot } from '../../common/casting/types';
import s from './ProcessOptimization.module.css';

const WINDOW = 100;              // 최근 표시 샷 수 (약 4시간)
const W = 620;                   // 세 그래프 공통 가로 (오른쪽 여백 = 관리선 값 표시 자리)
const L = 44, R = 86, T = 10, B = 22;
const TIP_W = 220;
/** 생산 흐름 색 — A 는 I·MR 진회색 / EWMA 파랑, B~D 는 세 그래프 공통 (▲ 주황·◆ 파랑과 겹치지 않게) */
const FLOW_COLORS = ['#0f9d8a', '#8b5cf6', '#b45309'];
const FLOW_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];
const MARK_TEXT: Record<SpcPoint['marks'][number], string> = {
  n1: '규칙 1: I 관리선 밖', n2: '규칙 2: 9점 연속 중심선 한쪽', n3: '규칙 3: 6점 연속 상승/하강',
  mr: 'MR 관리선 밖 (샷 간 변동 큼)', ewma: 'EWMA 관리선 밖 (평균 이동)',
};
type Kind = 'i' | 'mr' | 'ewma';
/** 그래프마다 보는 표시 — ▲ 주의 = 규칙 1, ◆ 관찰 = 나머지 */
const MARKS_OF: Record<Kind, SpcPoint['marks']> = { i: ['n1', 'n2', 'n3'], mr: ['mr'], ewma: ['ewma'] };

/** 'H:mm:ss' → 하루 안 분 */
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/**
 * 관리도(SPC) — 왼쪽 위 I, 왼쪽 아래 MR, 오른쪽 EWMA. UCL·LCL 실선, CL 점선. 기준선 = 라인별·변수별 고정 표 (서버 casting/spc.py)
 * EWMA·MR·넬슨 2·3 은 서버가 **생산 흐름별로 생산 런의 첫 샷(재가동 후 첫 샷)부터** 계산하고, 여기서는 보이는 구간만 그림.
 * 날짜·창·라인 선택은 보여 주는 범위만 바꿈. 라인1 원본 구간처럼 생산 흐름이 여러 개면 흐름별 선을 겹쳐 그림
 */
function SpcChart({ shots, k, line }: { shots: Shot[]; k: FeatureKey; line: string }) {
  const win = shots.filter(x => x.castingId).slice(-WINDOW);
  const first = win[0]?.castingId, last = win[win.length - 1]?.castingId;
  const [data, setData] = useState<{ key: string; spc: SpcData } | null>(null);
  const [error, setError] = useState('');
  const reqKey = `${line}|${k}|${first}|${last}`;

  // 보이는 구간·변수·라인이 바뀔 때만 조회 (실시간은 새 샷이 붙을 때)
  useEffect(() => {
    if (!first || !last) return;
    let alive = true; // 늦게 온 이전 구간 응답은 버림
    setError('');
    fetchSpc(line, k, first, last)
      .then(spc => alive && setData({ key: reqKey, spc }))
      .catch((e: Error) => {
        console.error('[process_optimization] 관리도 조회 실패', line, k, e);
        if (alive) setError(e.message);
      });
    return () => { alive = false; };
  }, [line, k, first, last, reqKey]);

  const head = (sub?: string) => (
    <div className={s.panelHead}>
      <h3>관리도(SPC) · {LABELS[k]}</h3>
      {sub && <span className={s.sub}>{sub}</span>}
    </div>
  );
  if (!first) return <section className={s.panel}>{head()}<p className={s.sub}>표시할 데이터가 없습니다.</p></section>;
  // 같은 라인·변수의 이전 구간 그림은 새 응답이 올 때까지 유지 (실시간·재생 중 깜빡임 방지). 변수·라인이 바뀌면 다시 불러오는 중
  const view = data && data.key.startsWith(`${line}|${k}|`) ? data : null;
  if (error && !view) return <section className={s.panel}>{head()}<p className={s.sub}>관리도를 불러오지 못했습니다: {error}</p></section>;
  if (!view) return <section className={s.panel}>{head()}<p className={s.sub}>관리도 불러오는 중…</p></section>;

  const { baseline: b, lambda, shots: pts } = view.spc;
  if (pts.length < 2) return <section className={s.panel}>{head()}<p className={s.sub}>표시할 데이터가 없습니다.</p></section>;
  const flows = Math.max(...pts.map(p => p.flow)) + 1;
  const approx = pts.some(p => p.approx);

  return (
    <section className={s.panel}>
      {head(`${line} 기준선 · 최근 ${pts.length}샷 · EWMA·MR·넬슨 2·3은 생산 런 기준 (재가동 후 첫 샷부터 계산)`)}
      <div className={s.spcGrid}>
        <ControlChart k={k} kind="i" pts={pts} h={250} className={s.spcI}
          lines={{ cl: b.cl, ucl: b.iUcl, lcl: b.iLcl }}
          title="I 관리도" note={`CL ${fmt(b.cl)} · 관리선 ${fmt(b.iLcl)} ~ ${fmt(b.iUcl)} (CL ± 3σ)`} />
        <ControlChart k={k} kind="mr" pts={pts} h={150} className={s.spcMr}
          lines={{ cl: b.mrCl, ucl: b.mrUcl, lcl: 0 }}
          title="MR 관리도" note={`MR̄ ${fmt(b.mrCl)} · UCL ${fmt(b.mrUcl)} (3.267 × MR̄)`} />
        <ControlChart k={k} kind="ewma" pts={pts} h={430} className={s.spcEw}
          lines={{ cl: b.cl, ucl: b.ewmaUcl, lcl: b.ewmaLcl }}
          title="EWMA 관리도" note={`λ ${lambda} · 관리선 ${fmt(b.ewmaLcl)} ~ ${fmt(b.ewmaUcl)} (CL ± 1σ) · 생산 런 첫 샷부터 계산`} />
      </div>
      <p className={s.spcLegend}>
        <span><i className={s.lgDot} />판정 샷</span>
        <span><i className={s.lgWarn} />주의 (규칙 1: I 관리선 밖)</span>
        <span><i className={s.lgWatch} />관찰 (규칙 2·3, MR·EWMA 관리선 밖)</span>
        <span><i className={s.lgCl} />중심선</span>
        <span><i className={s.lgLimit} />관리선</span>
        {flows > 1 && Array.from({ length: flows }, (_, f) => (
          <span key={f}><i className={s.lgFlow} style={{ background: f ? FLOW_COLORS[(f - 1) % FLOW_COLORS.length] : 'var(--ink)' }} />생산 흐름 {FLOW_NAMES[f] ?? f + 1}</span>
        ))}
        <span>빈 값 샷은 판정 제외 · σ = MR̄ / 1.128{approx && ' · 일부 흐름은 런 시작이 조회 범위보다 앞이라 앞쪽 6,000샷부터 계산'}</span>
      </p>
    </section>
  );
}

/** 관리도 1개 — UCL·LCL 빨간 실선, CL 회색 점선, 가로축 = 샷 순서(눈금 글자 = 시각), 흐름별 선 겹침, ▲ 주의 · ◆ 관찰 */
function ControlChart({ k, kind, pts, lines, h, title, note, className }: {
  k: FeatureKey; kind: Kind; pts: SpcPoint[]; lines: { cl: number; ucl: number; lcl: number };
  h: number; title: string; note: string; className: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const valOf = (p: SpcPoint) => (kind === 'i' ? p.value : kind === 'mr' ? p.mr : p.ewma);
  const shown = pts.map((p, i) => ({ p, i, y: valOf(p) })).filter((x): x is { p: SpcPoint; i: number; y: number } => x.y != null);
  const vals = shown.map(x => x.y);
  const lo = Math.min(lines.lcl, ...vals), hi = Math.max(lines.ucl, ...vals);
  const pad = (hi - lo) * 0.06 || 1;
  const y = (v: number) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (h - T - B);
  const x = (i: number) => L + (pts.length > 1 ? (i / (pts.length - 1)) * (W - L - R) : (W - L - R) / 2);
  // 눈금: 시각이 30분 경계를 넘는 샷 위치 (샷 순서 축이라 시각이 거꾸로 가도 선이 꺾이지 않음)
  const ticks = pts.flatMap((p, i) => {
    if (!i) return [];
    const a = Math.floor(toMin(pts[i - 1].time) / 30), c = Math.floor(toMin(p.time) / 30);
    return a !== c ? [{ i, label: `${Math.floor((c * 30) / 60)}:${String((c * 30) % 60).padStart(2, '0')}` }] : [];
  }).filter((t, j, all) => !j || x(t.i) - x(all[j - 1].i) > 34); // 글자 겹침 방지
  const flows = Math.max(...pts.map(p => p.flow)) + 1;
  const color = (f: number) => (f ? FLOW_COLORS[(f - 1) % FLOW_COLORS.length] : kind === 'ewma' ? 'var(--accent)' : 'var(--ink)');
  const marksOf = (p: SpcPoint) => p.marks.filter(m => MARKS_OF[kind].includes(m));
  const hp = hover != null ? shown.find(z => z.i === hover) : undefined;
  const unit = unitOf(k);
  const marked = shown.filter(z => marksOf(z.p).length).length;
  // UCL·LCL = 빨간 실선, CL = 회색 점선 (사용자 지정)
  const guides = [
    { name: 'UCL', v: lines.ucl, dash: undefined, color: 'var(--bad)', cls: s.limitText },
    { name: 'CL', v: lines.cl, dash: '5 4', color: 'var(--muted)', cls: s.clText },
    { name: 'LCL', v: lines.lcl, dash: undefined, color: 'var(--bad)', cls: s.limitText },
  ];

  return (
    <figure className={`${s.spcBox} ${className}`}>
      <figcaption className={s.spcCaption}>
        <b>{title}</b>
        <span className={s.sub}>{note}{marked > 0 && <> · 표시 <b className={s.spcTrend}>{marked}</b>점</>}</span>
      </figcaption>
      <svg className={s.chart} viewBox={`0 0 ${W} ${h}`} role="img"
        aria-label={`${LABELS[k]} ${title}, UCL ${fmt(lines.ucl)}, CL ${fmt(lines.cl)}, LCL ${fmt(lines.lcl)}, 표시 ${marked}점${flows > 1 ? `, 생산 흐름 ${flows}개` : ''}`}>
        {ticks.map(t => (
          <g key={t.i}>
            <line x1={x(t.i)} x2={x(t.i)} y1={T} y2={h - B} stroke="var(--line)" strokeWidth={0.6} />
            <text x={x(t.i)} y={h - 6} textAnchor="middle">{t.label}</text>
          </g>
        ))}
        {[lo - pad, (lo + hi) / 2, hi + pad].map((v, j) => <text key={j} x={L - 6} y={y(v) + 3} textAnchor="end">{fmt(v)}</text>)}
        {guides.map(g => (
          <g key={g.name}>
            <line x1={L} x2={W - R} y1={y(g.v)} y2={y(g.v)} stroke={g.color} strokeWidth={1.3} strokeDasharray={g.dash} />
            <text x={W - R + 6} y={y(g.v) + 3} className={g.cls}>{g.name} {fmt(g.v)}</text>
          </g>
        ))}

        {/* 흐름별 선 — 생산 런이 바뀌는 곳(재가동)에서는 선을 끊음 */}
        {Array.from({ length: flows }, (_, f) => {
          const segs: string[][] = [];
          for (const z of shown) {
            if (z.p.flow !== f) continue;
            if (!segs.length || z.p.runStart) segs.push([]);
            segs[segs.length - 1].push(`${x(z.i).toFixed(1)},${y(z.y).toFixed(1)}`);
          }
          return segs.map((pt, j) => (
            <polyline key={`${f}-${j}`} fill="none" stroke={color(f)} strokeOpacity={kind === 'ewma' || f ? 1 : 0.75}
              strokeWidth={kind === 'ewma' ? 1.6 : 1.1} points={pt.join(' ')} />
          ));
        })}
        {shown.map(({ p, i, y: v }) => {
          const cx = x(i), cy = y(v), m = marksOf(p);
          return (
            <g key={p.castingId} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={cx} cy={cy} r={6} fill="transparent" />
              {kind !== 'ewma' && <circle cx={cx} cy={cy} r={hover === i ? 3.6 : 2.2} fill={color(p.flow)} fillOpacity={0.85} />}
              {m.includes('n1')
                ? <path d={`M${cx} ${cy + 5} l5 9 h-10 z`} fill="#e8743b" />
                : m.length > 0 && <path d={`M${cx} ${cy - 5} l5 5 -5 5 -5 -5 z`} fill="var(--accent)" />}
            </g>
          );
        })}

        {hp && (() => {
          const m = marksOf(hp.p);
          const rows = [
            `#${hp.p.shotId} · ${hp.p.time}${flows > 1 ? ` · 흐름 ${FLOW_NAMES[hp.p.flow] ?? hp.p.flow + 1}` : ''}${hp.p.runStart ? ' · 런 첫 샷' : ''}`,
            `${LABELS[k]} ${fmt(hp.p.value)}${unit && ` ${unit}`}`,
            ...(kind === 'i' ? [] : [`${kind === 'mr' ? 'MR' : 'EWMA'} ${fmt(hp.y)}`]),
          ];
          const bh = 8 + (rows.length + m.length) * 14;
          const tx = Math.min(Math.max(x(hp.i) - TIP_W / 2, L), W - R - TIP_W);
          const ty = y(hp.y) > T + bh + 10 ? y(hp.y) - bh - 10 : y(hp.y) + 10;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TIP_W} height={bh} rx={4} fill="var(--ink)" opacity={0.9} />
              {rows.map((r, j) => <text key={j} x={tx + 8} y={ty + 14 + j * 14} className={s.tipText}>{r}</text>)}
              {m.map((mk, j) => (
                <text key={mk} x={tx + 8} y={ty + 14 + (rows.length + j) * 14} className={mk === 'n1' ? s.tipRule : s.tipTrend}>{MARK_TEXT[mk]}</text>
              ))}
            </g>
          );
        })()}
      </svg>
    </figure>
  );
}

export default memo(SpcChart);
