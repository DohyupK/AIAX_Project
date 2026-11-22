"use client";

import { useMemo } from "react";
import type { AlPriceRow } from "./api";
import s from "./AlPrice.module.css";

const W = 720;
const H = 220;
const L = 52;
const R = 12;
const T = 14;
const B = 28;

export type ChartPeriod = "1m" | "6m" | "1y" | "5y";

/** rows: 최신→과거. 반환: 과거→최신, 필요 시 샘플 */
function preparePts(rows: AlPriceRow[], period: ChartPeriod): AlPriceRow[] {
  const asc = [...rows].reverse();
  if (period !== "5y" || asc.length <= 160) return asc;
  const step = Math.ceil(asc.length / 160);
  const out: AlPriceRow[] = [];
  for (let i = 0; i < asc.length; i += step) out.push(asc[i]);
  const last = asc[asc.length - 1];
  if (out[out.length - 1]?.price_date !== last.price_date) out.push(last);
  return out;
}

function PriceChart({
  rows,
  period,
}: {
  rows: AlPriceRow[];
  period: ChartPeriod;
}) {
  const pts = useMemo(() => preparePts(rows, period), [rows, period]);

  const { path, minP, maxP, first, last, yTicks } = useMemo(() => {
    if (!pts.length) {
      return {
        path: "",
        minP: 0,
        maxP: 1,
        first: "",
        last: "",
        yTicks: [0, 0.5, 1],
      };
    }
    const prices = pts.map((p) => p.price);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
    const x = (i: number) =>
      L + (i / Math.max(pts.length - 1, 1)) * (W - L - R);
    const yFn = (p: number) =>
      T + (1 - (p - lo) / (hi - lo)) * (H - T - B);
    const d = pts
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(i).toFixed(1)},${yFn(p.price).toFixed(1)}`,
      )
      .join("");
    return {
      path: d,
      minP: lo,
      maxP: hi,
      first: pts[0].price_date,
      last: pts[pts.length - 1].price_date,
      yTicks: [lo, (lo + hi) / 2, hi],
    };
  }, [pts]);

  if (!pts.length) {
    return <p className={s.empty}>그래프에 표시할 데이터가 없습니다.</p>;
  }

  const y = (p: number) =>
    T + (1 - (p - minP) / (maxP - minP)) * (H - T - B);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={s.chart}
      role="img"
      aria-label={`알루미늄 시세 추이 ${first} ~ ${last}`}
    >
      {yTicks.map((p) => (
        <g key={p}>
          <line
            x1={L}
            x2={W - R}
            y1={y(p)}
            y2={y(p)}
            stroke="var(--al-line)"
          />
          <text
            x={L - 6}
            y={y(p) + 3}
            textAnchor="end"
            className={s.chartLabel}
          >
            {Math.round(p).toLocaleString("en-US")}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--al-accent)" strokeWidth="1.75" />
      <text x={L} y={H - 6} className={s.chartLabel}>
        {first}
      </text>
      <text x={W - R} y={H - 6} textAnchor="end" className={s.chartLabel}>
        {last}
      </text>
    </svg>
  );
}

export default PriceChart;
