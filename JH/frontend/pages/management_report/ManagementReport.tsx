'use client';
import { useEffect, useMemo, useState } from 'react';
import { REPORTS, type Period } from './data';
import { LIST_COUNT, listReports, mockReport, ratio, type ReportItem } from './logic';
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

  // 목록 + 리포트별 목업 값 (ponytail: 집계 API 연동 시 목록·값을 API 로 조회)
  // 목록보다 1건 더 만들어 마지막 행도 직전 기간(prev)과 비교
  const rows = useMemo(() => {
    if (!now) return [];
    const all = listReports(period, now, LIST_COUNT[period] + 1)
      .map(item => ({ item, report: mockReport(REPORTS[period], item.id) }));
    return all.slice(0, -1).map((x, i) => ({ ...x, prev: all[i + 1].report }));
  }, [period, now]);
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

      <div className={po.banner}>목업 데이터: 생산·근태·안전 집계 API 연동 전 예시 값입니다.</div>

      <section className={po.panel}>
        <div className={po.panelHead}>
          <h3>{PERIODS.find(p => p.key === period)!.label} 리포트 목록</h3>
          <span className={po.sub}>최신순 · {rows.length}건 · 행을 누르면 리포트 열기</span>
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
                  <td className={po.num}>{r.production.toLocaleString()}개</td>
                  <td className={po.num}>{pct(ratio(r.defects, r.production))}</td>
                  <td className={po.num}>{pct(ratio(r.attendance.present, r.attendance.total))}</td>
                  <td className={po.num}>{r.safety.violations}건</td>
                </tr>
              ))}
              {!now && <tr><td colSpan={6}>불러오는 중…</td></tr>}
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
