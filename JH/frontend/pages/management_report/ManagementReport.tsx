'use client';
import { useEffect, useMemo, useState } from 'react';
import { REPORTS, fetchDailyProduction, fetchSafety, type DailyProduction, type Period, type SafetyData } from './data';
import { LIST_COUNT, listReports, mockReport, ratio, withActual, withSafety, type ReportItem } from './logic';
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
  const [open, setOpen] = useState<ReportItem | null>(null);
  // 오늘 날짜는 브라우저에서만 계산 (서버 렌더 시각과 어긋나지 않게)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const [data, setData] = useState<{ daily: DailyProduction[]; safety: SafetyData } | null>(null); // null = 불러오는 중
  const [error, setError] = useState('');

  // 목록보다 1건 더 만들어 마지막 행도 직전 기간(prev)과 비교
  const items = useMemo(() => (now ? listReports(period, now, LIST_COUNT[period] + 1) : []), [period, now]);

  // 목록 전체 기간의 생산·안전을 한 번에 조회 (탭을 바꿀 때마다)
  useEffect(() => {
    if (!items.length) return;
    let alive = true; // 탭을 빨리 바꿀 때 늦게 온 이전 탭 응답은 버림
    const from = items[items.length - 1].from, to = items[0].to;
    setData(null);
    setError('');
    Promise.all([fetchDailyProduction(from, to), fetchSafety(from, to)])
      .then(([daily, safety]) => alive && setData({ daily, safety }))
      .catch((e: unknown) => {
        console.error('[management_report] 생산·안전 집계 조회 실패', e);
        if (alive) setError('생산·안전 데이터를 불러오지 못했습니다. JH API 서버를 확인해 주세요.');
      });
    return () => { alive = false; };
  }, [items]);

  // 리포트 값 = 목업 + 실제 생산량·불량·안전
  const rows = useMemo(() => {
    if (!data) return [];
    const all = items.map(item => ({
      item,
      report: withSafety(withActual(mockReport(REPORTS[period], item.id), data.daily, item.from, item.to), data.safety, item.from, item.to),
    }));
    return all.slice(0, -1).map((x, i) => ({ ...x, prev: all[i + 1].report }));
  }, [items, data, period]);
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
              className={`${s.tab} ${period === p.key ? s.tabOn : ''}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className={po.banner}>생산량·불량(mes, 세 라인 합계)과 안전(보호구 판정)은 서버 실제 값입니다. 「목업」 표시 항목(근태·SPC·1차 불량·재활용·불량 유형)은 집계 연동 전 예시 값입니다.</div>

      <section className={po.panel}>
        <div className={po.panelHead}>
          <h3>{PERIODS.find(p => p.key === period)!.label} 리포트 목록</h3>
          <span className={po.sub}>최신순 · {rows.length}건 · 행을 누르면 리포트 열기</span>
        </div>
        <div className={s.listWrap}>
          <table className={`${s.table} ${s.listTable}`}>
            <thead>
              <tr><th>리포트</th><th>대상 기간</th><th>생산량</th><th>불량률</th><th>출근율 <small>(목업)</small></th><th>안전 위반</th></tr>
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
      </section>

      {opened && now && (
        <ReportDialog item={opened.item} report={opened.report} prev={opened.prev} printedAt={now.toLocaleString('ko-KR')} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
