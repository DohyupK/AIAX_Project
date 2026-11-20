'use client';
import { memo, useEffect, useState } from 'react';
import { LABELS, fmt, unitOf } from '../../common/casting/analysis';
import { fetchSpc, type SpcData, type SpcPoint } from '../../common/casting/api';
import type { FeatureKey, Shot } from '../../common/casting/types';
import { CARD, CARD_HEAD, CARD_TITLE, SUB } from '../../common/ui';

const WINDOW = 100;              // 최근 표시 샷 수 (약 4시간)
const W = 620;                   // 세 그래프 공통 가로 (오른쪽 여백 = 관리선 값 표시 자리)
const L = 44, R = 86, T = 10, B = 22;
/** 생산 흐름 색 — A 는 I·MR 진회색 / EWMA 남색, B~D 는 세 그래프 공통 (▲ 주황·◆ 파랑과 겹치지 않게) */
const FLOW_COLORS = ['#0f9d8a', '#8b5cf6', '#b45309'];
const FLOW_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];
// 흐름 A 색 — 라이트/다크 전환 (나머지 흐름은 두 모드 모두 보이는 고정 색)
const INK_STROKE = 'stroke-gray-700 dark:stroke-gray-300';
const INK_FILL = 'fill-gray-700 dark:fill-gray-300';
const EWMA_STROKE = 'stroke-brand-500 dark:stroke-brand-400';
// 축 글자
const AXIS = 'fill-gray-400 font-mono text-[10px] dark:fill-gray-500';
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
 * 1180px 이하: 세 그래프 세로. 폰(460px 이하): 그래프마다 카드 안에서만 좌우 스크롤 (글자가 읽히는 최소 폭)
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

  const card = (sub: string | null, body: React.ReactNode) => (
    <section className={CARD}>
      <header className={CARD_HEAD}>
        <h2 className={CARD_TITLE}>관리도(SPC) · {LABELS[k]}</h2>
        {sub && <span className={SUB}>{sub}</span>}
      </header>
      <div className="p-5 phone:p-3">{body}</div>
    </section>
  );
  const msg = (t: string) => card(null, <p className={SUB}>{t}</p>);

  if (!first) return msg('표시할 데이터가 없습니다.');
  // 같은 라인·변수의 이전 구간 그림은 새 응답이 올 때까지 유지 (실시간·재생 중 깜빡임 방지). 변수·라인이 바뀌면 다시 불러오는 중
  const view = data && data.key.startsWith(`${line}|${k}|`) ? data : null;
  if (error && !view) return msg(`관리도를 불러오지 못했습니다: ${error}`);
  if (!view) return msg('관리도 불러오는 중…');

  const { baseline: b, lambda, shots: pts } = view.spc;
  if (pts.length < 2) return msg('표시할 데이터가 없습니다.');
  const flows = Math.max(...pts.map(p => p.flow)) + 1;
  const approx = pts.some(p => p.approx);

  return card(
    `${line} 기준선 · 최근 ${pts.length}샷 · EWMA·MR·넬슨 2·3은 생산 런 기준 (재가동 후 첫 샷부터 계산)`,
    <>
      <div className="grid gap-3 min-[1181px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] min-[1181px]:[grid-template-areas:'i_ew'_'mr_ew']">
        <ControlChart k={k} kind="i" pts={pts} h={250} className="min-[1181px]:[grid-area:i]"
          lines={{ cl: b.cl, ucl: b.iUcl, lcl: b.iLcl }}
          title="I 관리도" note={`CL ${fmt(b.cl)} · 관리선 ${fmt(b.iLcl)} ~ ${fmt(b.iUcl)} (CL ± 3σ)`} />
        <ControlChart k={k} kind="mr" pts={pts} h={150} className="min-[1181px]:[grid-area:mr]"
          lines={{ cl: b.mrCl, ucl: b.mrUcl, lcl: 0 }}
          title="MR 관리도" note={`MR̄ ${fmt(b.mrCl)} · UCL ${fmt(b.mrUcl)} (3.267 × MR̄)`} />
        <ControlChart k={k} kind="ewma" pts={pts} h={430} className="min-[1181px]:[grid-area:ew]"
          lines={{ cl: b.cl, ucl: b.ewmaUcl, lcl: b.ewmaLcl }}
          title="EWMA 관리도" note={`λ ${lambda} · 관리선 ${fmt(b.ewmaLcl)} ~ ${fmt(b.ewmaUcl)} (CL ± 1σ) · 생산 런 첫 샷부터 계산`} />
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5"><i className="size-[7px] rounded-full bg-gray-700 dark:bg-gray-300" />판정 샷</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-orange-500" />주의 (규칙 1: I 관리선 밖)</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2 rotate-45 bg-brand-500 dark:bg-brand-400" />관찰 (규칙 2·3, MR·EWMA 관리선 밖)</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-[18px] border-t-[1.5px] border-dashed border-gray-400" />중심선</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-[18px] border-t-[1.5px] border-red-500" />관리선</span>
        {flows > 1 && Array.from({ length: flows }, (_, f) => (
          <span key={f} className="inline-flex items-center gap-1.5">
            <i className={`h-[3px] w-3 rounded-sm ${f ? '' : 'bg-gray-700 dark:bg-gray-300'}`} style={f ? { background: FLOW_COLORS[(f - 1) % FLOW_COLORS.length] } : undefined} />
            생산 흐름 {FLOW_NAMES[f] ?? f + 1}
          </span>
        ))}
        <span>빈 값 샷은 판정 제외 · σ = MR̄ / 1.128{approx && ' · 일부 흐름은 런 시작이 조회 범위보다 앞이라 앞쪽 6,000샷부터 계산'}</span>
      </p>
    </>,
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
  // 흐름 A 는 테마 색(클래스), B~ 는 고정 색(속성)
  const flowStroke = (f: number) => (f ? { stroke: FLOW_COLORS[(f - 1) % FLOW_COLORS.length] } : { className: kind === 'ewma' ? EWMA_STROKE : INK_STROKE });
  const flowFill = (f: number) => (f ? { fill: FLOW_COLORS[(f - 1) % FLOW_COLORS.length] } : { className: INK_FILL });
  const marksOf = (p: SpcPoint) => p.marks.filter(m => MARKS_OF[kind].includes(m));
  const hp = hover != null ? shown.find(z => z.i === hover) : undefined;
  const unit = unitOf(k);
  const marked = shown.filter(z => marksOf(z.p).length).length;
  // UCL·LCL = 빨간 실선, CL = 회색 점선 (사용자 지정)
  const guides = [
    { name: 'UCL', v: lines.ucl, dash: undefined, line: 'stroke-red-500', text: 'fill-red-500 text-[11px] font-semibold' },
    { name: 'CL', v: lines.cl, dash: '5 4', line: 'stroke-gray-400 dark:stroke-gray-500', text: 'fill-gray-500 text-[11px] dark:fill-gray-400' },
    { name: 'LCL', v: lines.lcl, dash: undefined, line: 'stroke-red-500', text: 'fill-red-500 text-[11px] font-semibold' },
  ];

  return (
    <figure className={`m-0 min-w-0 rounded-lg border border-gray-200 px-3 pt-2.5 pb-1 dark:border-gray-700/60 ${className}`}>
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <b className="font-semibold text-gray-800 dark:text-gray-100">{title}</b>
        <span className={SUB}>{note}{marked > 0 && <> · 표시 <b className="text-yellow-600 dark:text-yellow-500">{marked}</b>점</>}</span>
      </figcaption>
      <div className="phone:overflow-x-auto">
        <div className="relative phone:min-w-[560px]">
          <svg className="block h-auto w-full" viewBox={`0 0 ${W} ${h}`} role="img"
            aria-label={`${LABELS[k]} ${title}, UCL ${fmt(lines.ucl)}, CL ${fmt(lines.cl)}, LCL ${fmt(lines.lcl)}, 표시 ${marked}점${flows > 1 ? `, 생산 흐름 ${flows}개` : ''}`}>
            {ticks.map(t => (
              <g key={t.i}>
                <line x1={x(t.i)} x2={x(t.i)} y1={T} y2={h - B} strokeWidth={0.6} className="stroke-gray-200 dark:stroke-gray-700" />
                <text x={x(t.i)} y={h - 6} textAnchor="middle" className={AXIS}>{t.label}</text>
              </g>
            ))}
            {[lo - pad, (lo + hi) / 2, hi + pad].map((v, j) => <text key={j} x={L - 6} y={y(v) + 3} textAnchor="end" className={AXIS}>{fmt(v)}</text>)}
            {guides.map(g => (
              <g key={g.name}>
                <line x1={L} x2={W - R} y1={y(g.v)} y2={y(g.v)} strokeWidth={1.3} strokeDasharray={g.dash} className={g.line} />
                <text x={W - R + 6} y={y(g.v) + 3} className={`font-mono ${g.text}`}>{g.name} {fmt(g.v)}</text>
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
                <polyline key={`${f}-${j}`} fill="none" {...flowStroke(f)} strokeOpacity={kind === 'ewma' || f ? 1 : 0.75}
                  strokeWidth={kind === 'ewma' ? 1.6 : 1.1} points={pt.join(' ')} />
              ));
            })}
            {shown.map(({ p, i, y: v }) => {
              const cx = x(i), cy = y(v), m = marksOf(p);
              return (
                <g key={p.castingId} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <circle cx={cx} cy={cy} r={6} fill="transparent" />
                  {kind !== 'ewma' && <circle cx={cx} cy={cy} r={hover === i ? 3.6 : 2.2} {...flowFill(p.flow)} fillOpacity={0.85} />}
                  {m.includes('n1')
                    ? <path d={`M${cx} ${cy + 5} l5 9 h-10 z`} className="fill-orange-500" />
                    : m.length > 0 && <path d={`M${cx} ${cy - 5} l5 5 -5 5 -5 -5 z`} className="fill-brand-500 dark:fill-brand-400" />}
                </g>
              );
            })}
          </svg>
          {/* 툴팁은 SVG 밖 HTML — 그래프 칸 폭이 달라도(EWMA 칸이 좁음) 세 그래프 모두 같은 글자 크기 */}
          {hp && (() => {
            const m = marksOf(hp.p);
            const left = (x(hp.i) / W) * 100, top = (y(hp.y) / h) * 100;
            const shift = left < 25 ? '0%' : left > 70 ? '-100%' : '-50%'; // 양 끝에서는 그래프 밖으로 나가지 않게
            const below = top < 35;                                      // 위쪽 점은 툴팁을 아래로
            return (
              <div className="pointer-events-none absolute z-[2] rounded-md bg-gray-900/90 px-2.5 py-1.5 font-mono text-xs leading-relaxed whitespace-nowrap text-white shadow-lg" role="tooltip"
                style={{ left: `${left}%`, top: `${top}%`, transform: `translate(${shift}, ${below ? '12px' : 'calc(-100% - 12px)'})` }}>
                <div>#{hp.p.shotId} · {hp.p.time}{flows > 1 && ` · 흐름 ${FLOW_NAMES[hp.p.flow] ?? hp.p.flow + 1}`}{hp.p.runStart && ' · 런 첫 샷'}</div>
                <div>{LABELS[k]} {fmt(hp.p.value)}{unit && ` ${unit}`}</div>
                {kind !== 'i' && <div>{kind === 'mr' ? 'MR' : 'EWMA'} {fmt(hp.y)}</div>}
                {m.map(mk => <div key={mk} className={`font-semibold ${mk === 'n1' ? 'text-red-300' : 'text-yellow-300'}`}>{MARK_TEXT[mk]}</div>)}
              </div>
            );
          })()}
        </div>
      </div>
    </figure>
  );
}

export default memo(SpcChart);
