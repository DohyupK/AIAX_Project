'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LINE, PRODUCT, type PeriodReport } from './data';
import type { ReportItem } from './logic';
import ReportView from './ReportView';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './ManagementReport.module.css';

// 인쇄 시 팝업만 출력: 팝업을 body 직속(portal)으로 두고 나머지 body 자식은 숨김
// (fixed 요소는 첫 페이지만 인쇄되므로 인쇄 때는 일반 흐름으로). CSS Modules 는 전역 선택자 불가 → <style> 주입
const PRINT_CSS = `@media print {
  @page { size: A4; margin: 12mm; }
  body > *:not([data-print-root]) { display: none !important; }
  [data-print-root] { position: static !important; display: block !important; padding: 0 !important; background: none !important; }
  [data-print-area] { width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; padding: 0 !important; }
  [data-print-hide] { display: none !important; }
  [data-print-area] * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const PREV_LABEL = { daily: '전일', weekly: '전주', monthly: '전월' } as const;

/** 리포트 팝업 — 우측 상단 PDF 출력(브라우저 인쇄 → 'PDF로 저장') */
export default function ReportDialog({ item, report, prev, printedAt, onClose }: {
  item: ReportItem; report: PeriodReport; prev: PeriodReport | null; printedAt: string; onClose: () => void;
}) {
  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function printPdf() {
    // PDF 기본 파일명 = 문서 제목 → 인쇄 동안만 리포트 제목으로 바꿈
    const prevTitle = document.title;
    document.title = item.title;
    window.print(); // 인쇄 창이 닫힐 때까지 대기 (동기)
    document.title = prevTitle;
  }

  return (
    // body 직속으로 렌더 (인쇄 전용 CSS 대상). po.page = 색상 토큰(.page 범위 변수) 상속용, 배치는 backdrop 이 덮어씀
    createPortal(<div className={`${po.page} ${po.backdrop}`} data-print-root onClick={onClose}>
      <style>{PRINT_CSS}</style>
      <div className={`${po.dialog} ${s.dialog}`} role="dialog" aria-modal="true" aria-labelledby="report-title"
        data-print-area onClick={e => e.stopPropagation()}>
        <div className={s.toolbar} data-print-hide>
          <button type="button" className={`${po.btn} ${s.pdfBtn}`} onClick={printPdf}>PDF 출력</button>
          <button type="button" className={po.closeBtn} onClick={onClose} aria-label="닫기" autoFocus>×</button>
        </div>
        <div className={s.reportHead}>
          <div>
            <h2 id="report-title" className={s.dialogTitle}>{item.title}</h2>
            <div className={s.meta}>
              <span>대상 기간 <b className={po.num}>{item.from === item.to ? item.from : `${item.from} ~ ${item.to}`}</b></span>
              <span>리포트 출력 <b className={po.num}>{printedAt}</b></span>
              <span>{LINE} {PRODUCT}</span>
            </div>
          </div>
          {/* 결재란 — 출력본 수기 서명용 (데이터 없음) */}
          <table className={s.sign} aria-label="결재란">
            <thead><tr><th>작성</th><th>공장장</th><th>대표</th></tr></thead>
            <tbody><tr><td>자동</td><td /><td /></tr></tbody>
          </table>
        </div>
        <div className={s.dialogBody}>
          <ReportView r={report} prev={prev} prevLabel={PREV_LABEL[item.period]} cumulative={item.period !== 'daily'} />
        </div>
      </div>
    </div>, document.body)
  );
}
