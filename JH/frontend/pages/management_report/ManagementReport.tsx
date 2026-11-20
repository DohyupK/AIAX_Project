'use client';
import { useEffect, useMemo, useState } from 'react';
import { fetchFirstDate, fetchReportSource, type Period, type ReportSource } from './data';
import { PAGE_SIZE, buildReport, listReports, ratio, reportCount, type ReportItem } from './logic';
import ReportDialog from './ReportDialog';
import { pct } from './ReportView';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './ManagementReport.module.css';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: '일일' },
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
];

/** 경영 관리자 리포트 — 기간별 리포트 목록, 행 클릭 시 리포트 팝업 */
export default function ManagementReport() {
  const [period, setPeriod] = useState<Period>('daily');
  const [page, setPage] = useState(0); // 0 = 최신 15건
  const [open, setOpen] = useState<ReportItem | null>(null);
  // 오늘 날짜는 브라우저에서만 계산 (서버 렌더 시각과 어긋나지 않게)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const [data, setData] = useState<ReportSource | null>(null); // null = 불러오는 중
  const [error, setError] = useState('');

  // 목록 시작일(생산 데이터 첫날) — 페이지 수 계산. 실패·데이터 없음(null)이면 1페이지만
  const [first, setFirst] = useState<string | null | undefined>(undefined); // undefined = 불러오는 중
  useEffect(() => {
    let alive = true;
    fetchFirstDate()
      .then(d => alive && setFirst(d))
      .catch((e: unknown) => {
        console.error('[management_report] 리포트 시작일 조회 실패 — 1페이지만 표시', e);
        if (alive) setFirst(null);
      });
    return () => { alive = false; };
  }, []);
  const total = now && first !== undefined ? (first ? reportCount(period, now, first) : PAGE_SIZE) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 현재 페이지 15건 + 1건 더 만들어 마지막 행도 직전 기간(prev)과 비교
  const items = useMemo(() => {
    if (!now || !total) return [];
    return listReports(period, now, Math.min(PAGE_SIZE, total - page * PAGE_SIZE) + 1, page * PAGE_SIZE);
  }, [period, now, total, page]);

  // 현재 페이지 기간의 원자료(생산·안전·SPC·근태·고정값)를 한 번에 조회 (탭·페이지를 바꿀 때마다)
  useEffect(() => {
    if (!items.length) return;
    let alive = true; // 탭을 빨리 바꿀 때 늦게 온 이전 탭 응답은 버림
    const from = items[items.length - 1].from, to = items[0].to;
    setData(null);
    setError('');
    fetchReportSource(from, to)
      .then(src => alive && setData(src))
      .catch((e: unknown) => {
        console.error('[management_report] 리포트 원자료 조회 실패', e);
        if (alive) setError('리포트 데이터를 불러오지 못했습니다. JH API 서버를 확인해 주세요.');
      });
    return () => { alive = false; };
  }, [items]);

  // 리포트 값 = 기간 원자료 합산 + 기간 마지막 날 기준 고정값
  const rows = useMemo(() => {
    if (!data) return [];
    const all = items.map(item => ({ item, report: buildReport(data, item.from, item.to) }));
    return all.slice(0, -1).map((x, i) => ({ ...x, prev: all[i + 1].report }));
  }, [items, data]);
  const opened = open && rows.find(x => x.item.id === open.id);

  return (
    <div className={po.page}>
      <header className={po.head}>
        <div>
          <div className={po.crumb}>경영 관리자 리포트</div>
          <h2 className={po.title}>경영 관리자 리포트</h2>
        </div>
        <div className={s.tabs} role="tablist" aria-label="리포트 기간">
          {PERIODS.map(p => (
            <button key={p.key} type="button" role="tab" aria-selected={period === p.key}
              className={`${s.tab} ${period === p.key ? s.tabOn : ''}`} onClick={() => { setPeriod(p.key); setPage(0); }}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className={po.banner}>모든 항목이 서버 데이터입니다 — 생산·불량·SPC(mes, 세 라인 합계), 안전(보호구 판정), 근태(근무 예정자 기준), 단가·재활용률·MTTR·MTBF·리콜(고정값 DB).</div>

      <section className={po.panel}>
        <div className={po.panelHead}>
          <h3>{PERIODS.find(p => p.key === period)!.label} 리포트 목록</h3>
          <span className={po.sub}>최신순 · 전체 {total}건 · {page + 1}/{pages}쪽 · 행을 누르면 리포트 열기</span>
        </div>
        <div className={s.listWrap}>
          <table className={`${s.table} ${s.listTable}`}>
            <thead>
              <tr><th>리포트</th><th>대상 기간</th><th>생산량</th><th>불량률</th><th>출근율</th><th>안전 위반</th></tr>
            </thead>
            <tbody>
              {rows.map(({ item, report: r }) => (
                <tr key={item.id} onClick={() => setOpen(item)}>
                  <td>
                    <button type="button" className={s.rowBtn} onClick={e => { e.stopPropagation(); setOpen(item); }}>{item.title}</button>
                  </td>
                  <td className={po.num}>{item.from === item.to ? item.from : `${item.from} ~ ${item.to}`}</td>
                  <td className={po.num}>{r.noData ? '—' : `${r.production.toLocaleString()}개`}</td>
                  <td className={po.num}>{pct(ratio(r.defects, r.production))}</td>
                  <td className={po.num}>{pct(ratio(r.attendance.present, r.attendance.total))}</td>
                  <td className={po.num}>{r.safety.violations}건</td>
                </tr>
              ))}
              {!error && !data && <tr><td colSpan={6}>불러오는 중…</td></tr>}
              {error && <tr><td colSpan={6}>{error}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={pages} onPage={setPage} />
      </section>

      {opened && now && (
        <ReportDialog item={opened.item} report={opened.report} prev={opened.prev} printedAt={now.toLocaleString('ko-KR')} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/** 목록 아래 페이지 번호 — 현재 쪽 앞뒤 최대 5개 번호 + 이전·다음. 1쪽뿐이면 숨김 */
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const start = Math.max(0, Math.min(page - 2, pages - 5));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  return (
    <nav className={s.pager} aria-label="리포트 목록 페이지">
      <button type="button" className={s.pageBtn} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="이전 페이지">‹</button>
      {nums.map(n => (
        <button key={n} type="button" className={`${s.pageBtn} ${n === page ? s.pageOn : ''}`}
          aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n + 1}</button>
      ))}
      <button type="button" className={s.pageBtn} disabled={page === pages - 1} onClick={() => onPage(page + 1)} aria-label="다음 페이지">›</button>
    </nav>
  );
}
