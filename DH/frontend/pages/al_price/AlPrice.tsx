"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadCsv,
  fetchMeta,
  fetchRange,
  type AlPriceMeta,
  type AlPriceRow,
} from "./api";
import {
  cacheKey,
  monthsAgoIso,
  pageWindow,
  totalPages,
} from "./dates";
import PriceChart, { type ChartPeriod } from "./PriceChart";
import s from "./AlPrice.module.css";

const CHART_PERIODS: { key: ChartPeriod; label: string; months: number }[] = [
  { key: "1m", label: "1개월", months: 1 },
  { key: "6m", label: "6개월", months: 6 },
  { key: "1y", label: "1년", months: 12 },
  { key: "5y", label: "5년", months: 60 },
];

function mergeRows(a: AlPriceRow[], b: AlPriceRow[]): AlPriceRow[] {
  const map = new Map<string, number>();
  for (const r of [...a, ...b]) map.set(r.price_date, r.price);
  return [...map.entries()]
    .map(([price_date, price]) => ({ price_date, price }))
    .sort((x, y) => (x.price_date < y.price_date ? 1 : -1));
}

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** LME 알루미늄 시세 — 구간 로드·그래프·CSV */
export default function AlPrice() {
  const [meta, setMeta] = useState<AlPriceMeta | null>(null);
  const [cache, setCache] = useState<Record<string, AlPriceRow[]>>({});
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const [page, setPage] = useState(1);
  const [yearRows, setYearRows] = useState<AlPriceRow[]>([]);
  const [tableRows, setTableRows] = useState<AlPriceRow[]>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("6m");
  const [chartRows, setChartRows] = useState<AlPriceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [csvBusy, setCsvBusy] = useState(false);
  const [booted, setBooted] = useState(false);
  const prefetching = useRef<Set<string>>(new Set());
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    if (!meta?.min_date || !meta?.max_date) return 1;
    return totalPages(meta.min_date, meta.max_date);
  }, [meta]);

  const putCache = useCallback((from: string, to: string, rows: AlPriceRow[]) => {
    const k = cacheKey(from, to);
    setCache((c) => ({ ...c, [k]: rows }));
  }, []);

  const loadPage = useCallback(
    async (maxDate: string, p: number): Promise<AlPriceRow[]> => {
      const { from, to } = pageWindow(maxDate, p);
      const k = cacheKey(from, to);
      const hit = cacheRef.current[k];
      if (hit) return hit;
      if (prefetching.current.has(k)) {
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 100));
          if (cacheRef.current[k]) return cacheRef.current[k];
        }
      }
      prefetching.current.add(k);
      try {
        const rows = await fetchRange(from, to);
        putCache(from, to, rows);
        return rows;
      } finally {
        prefetching.current.delete(k);
      }
    },
    [putCache],
  );

  const prefetchPage = useCallback(
    (maxDate: string, p: number, pageCount: number) => {
      if (p < 1 || p > pageCount) return;
      const { from, to } = pageWindow(maxDate, p);
      const k = cacheKey(from, to);
      if (cacheRef.current[k] || prefetching.current.has(k)) return;
      prefetching.current.add(k);
      fetchRange(from, to)
        .then((rows) => putCache(from, to, rows))
        .catch((e) => console.error("[al_price] prefetch", e))
        .finally(() => prefetching.current.delete(k));
    },
    [putCache],
  );

  // 진입: meta → 6개월 → 1년 확장 → 다음 페이지 프리페치
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const m = await fetchMeta();
        if (!alive) return;
        setMeta(m);
        if (!m.max_date || m.count === 0) {
          setTableRows([]);
          setYearRows([]);
          setChartRows([]);
          setBooted(true);
          return;
        }
        const pageCount = m.min_date
          ? totalPages(m.min_date, m.max_date)
          : 1;
        const first = await loadPage(m.max_date, 1);
        if (!alive) return;
        setTableRows(first);
        setYearRows(first);
        setPage(1);
        const second = await loadPage(m.max_date, 2);
        if (!alive) return;
        const year = mergeRows(first, second);
        setYearRows(year);
        setTableRows(year);
        prefetchPage(m.max_date, 3, pageCount);
        setBooted(true);
      } catch (e) {
        console.error("[al_price]", e);
        if (alive) setError((e as Error).message || "시세 조회 실패");
        setBooted(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadPage, prefetchPage]);

  // 페이지 탭 (부팅 후)
  useEffect(() => {
    if (!booted || !meta?.max_date || loading) return;
    const maxDate = meta.max_date; // string | null 좁히기 (tsc — loadPage/prefetchPage 인자)
    let alive = true;
    (async () => {
      try {
        if (page === 1 && yearRows.length) {
          setTableRows(yearRows);
        } else {
          const rows = await loadPage(maxDate, page);
          if (alive) setTableRows(rows);
        }
        prefetchPage(maxDate, page + 1, pages);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [page, booted]); // eslint-disable-line react-hooks/exhaustive-deps

  // 차트 기간
  useEffect(() => {
    if (!meta?.max_date) return;
    let alive = true;
    const months =
      CHART_PERIODS.find((p) => p.key === chartPeriod)?.months ?? 6;
    const from = monthsAgoIso(meta.max_date, months);
    fetchRange(from, meta.max_date)
      .then((rows) => {
        if (alive) setChartRows(rows);
      })
      .catch((e) => console.error("[al_price] chart", e));
    return () => {
      alive = false;
    };
  }, [chartPeriod, meta?.max_date]);

  const onScroll = () => {
    const el = tableWrapRef.current;
    if (!el || !meta?.max_date) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (nearBottom) prefetchPage(meta.max_date, page + 1, pages);
  };

  const kpi = useMemo(() => {
    const src = yearRows.length ? yearRows : tableRows;
    if (!src.length) return null;
    const latest = src[0];
    const prev = src[1];
    const delta = prev ? latest.price - prev.price : null;
    const pct =
      prev && prev.price !== 0
        ? ((latest.price - prev.price) / prev.price) * 100
        : null;
    const prices = src.map((r) => r.price);
    return {
      latest,
      delta,
      pct,
      high: Math.max(...prices),
      low: Math.min(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    };
  }, [yearRows, tableRows]);

  const onCsv = async () => {
    setCsvBusy(true);
    setError(null);
    try {
      await downloadCsv();
    } catch (e) {
      setError((e as Error).message || "CSV 다운로드 실패");
    } finally {
      setCsvBusy(false);
    }
  };

  const pageButtons = useMemo(() => {
    const maxShow = Math.min(pages, 24);
    return Array.from({ length: maxShow }, (_, i) => i + 1);
  }, [pages]);

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.headRow}>
          <div>
            <h1 className={s.title}>알루미늄 가격</h1>
            <p className={s.sub}>
              LME 알루미늄(Al) 현물 · US$/톤 · 한국비철금속협회 · 최근 6개월→1년
              확장 로드
            </p>
          </div>
          <button
            type="button"
            className={s.csvBtn}
            onClick={onCsv}
            disabled={csvBusy || !meta?.count}
          >
            {csvBusy ? "CSV 준비 중…" : "CSV 전체 다운로드"}
          </button>
        </div>
      </header>

      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}

      {loading && <p className={s.empty}>불러오는 중…</p>}

      {!loading && meta && meta.count === 0 && (
        <p className={s.empty}>
          저장된 시세가 없습니다. 백필·MS 적재·daily를 확인하세요.
        </p>
      )}

      {kpi && (
        <section className={s.kpiRow} aria-label="시세 요약">
          <div className={s.kpi}>
            <div className={s.kpiLabel}>최신</div>
            <div className={s.kpiValue}>
              {fmt(kpi.latest.price)}{" "}
              <span className={s.kpiUnit}>US$/톤</span>
            </div>
            <div className={s.kpiSub}>{kpi.latest.price_date}</div>
          </div>
          <div className={s.kpi}>
            <div className={s.kpiLabel}>전일 대비</div>
            <div
              className={`${s.kpiValue} ${
                kpi.delta == null ? "" : kpi.delta >= 0 ? s.up : s.down
              }`}
            >
              {kpi.delta == null
                ? "—"
                : `${kpi.delta >= 0 ? "+" : ""}${fmt(kpi.delta)} (${
                    kpi.pct != null
                      ? `${kpi.pct >= 0 ? "+" : ""}${fmt(kpi.pct, 2)}%`
                      : ""
                  })`}
            </div>
          </div>
          <div className={s.kpi}>
            <div className={s.kpiLabel}>최근 1년 고가</div>
            <div className={s.kpiValue}>{fmt(kpi.high)}</div>
          </div>
          <div className={s.kpi}>
            <div className={s.kpiLabel}>최근 1년 저가</div>
            <div className={s.kpiValue}>{fmt(kpi.low)}</div>
          </div>
          <div className={s.kpi}>
            <div className={s.kpiLabel}>최근 1년 평균</div>
            <div className={s.kpiValue}>{fmt(kpi.avg)}</div>
          </div>
        </section>
      )}

      {meta?.max_date && (
        <section className={s.chartSection}>
          <div className={s.tabs} role="tablist" aria-label="그래프 기간">
            {CHART_PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={chartPeriod === p.key}
                className={chartPeriod === p.key ? s.tabOn : s.tab}
                onClick={() => setChartPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <PriceChart rows={chartRows} period={chartPeriod} />
        </section>
      )}

      {tableRows.length > 0 && (
        <>
          <div className={s.tableHead}>
            <h2 className={s.sectionTitle}>
              일자별 시세
              {page === 1 ? " (최근 최대 1년)" : ` (페이지 ${page})`}
            </h2>
            <span className={s.muted}>{tableRows.length}건</span>
          </div>
          <div
            className={s.tableWrap}
            ref={tableWrapRef}
            onScroll={onScroll}
          >
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">일자</th>
                  <th scope="col">Al (US$/톤)</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.price_date}>
                    <td>{r.price_date}</td>
                    <td className={s.num}>{fmt(r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className={s.pager} aria-label="시세 페이지 (6개월 단위)">
            {pageButtons.map((n) => (
              <button
                key={n}
                type="button"
                className={page === n ? s.pageOn : s.pageBtn}
                onClick={() => {
                  setPage(n);
                  if (meta?.max_date) prefetchPage(meta.max_date, n + 1, pages);
                }}
              >
                {n}
              </button>
            ))}
            {pages > pageButtons.length && (
              <span className={s.muted}>… 총 {pages}페이지</span>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
