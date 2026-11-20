'use client';
import { useEffect } from 'react';
import type { HandoverReport } from './buildHandoverReport';
import s from './ShiftHandover.module.css';

const PRINT_CSS = `@media print {
  @page { size: A4; margin: 12mm; }
  body > *:not([data-print-root]) { display: none !important; }
  [data-print-root] { position: static !important; display: block !important; padding: 0 !important; background: none !important; }
  [data-print-area] { width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }
  [data-print-hide] { display: none !important; }
  [data-print-area] * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const LINE_LABEL: Record<string, string> = {
  line_no1: '라인 1',
  line_no2: '라인 2',
  line_no3: '라인 3',
};

function printPdf(docTitle: string) {
  const prev = document.title;
  document.title = docTitle;
  window.print();
  document.title = prev;
}

/** 인수인계 리포트 본문 + PDF 출력 */
export default function HandoverDialog({
  report,
  loading,
  error,
  onClose,
  onRetry,
}: {
  report: HandoverReport | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const win = report?.window;
  const docTitle = win
    ? `인수인계_${win.label}_${win.key.replace(/[|:]/g, '-')}`
    : '인수인계_리포트';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={s.backdrop} data-print-root onClick={onClose}>
      <div
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="handover-title"
        data-print-area
        onClick={e => e.stopPropagation()}
      >
        <style>{PRINT_CSS}</style>
        <div className={s.toolbar} data-print-hide>
          <h2 id="handover-title" className={s.title}>
            교대 인수인계 리포트
            {win?.partial && <span className={s.badge}>부분 집계</span>}
          </h2>
          {report && !loading && (
            <button type="button" className={`${s.btn} ${s.printBtn}`} onClick={() => printPdf(docTitle)}>
              PDF 출력
            </button>
          )}
          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="닫기" autoFocus>×</button>
        </div>

        {loading && <div className={s.statusBox} role="status">교대 구간 데이터를 집계하는 중…</div>}

        {!loading && error && (
          <div className={s.errorBox} role="alert">
            <span>{error}</span>
            <button type="button" className={s.btn} onClick={onRetry}>다시 시도</button>
          </div>
        )}

        {!loading && !error && report && win && (
          <div className={s.paper}>
            <div className={s.metaGrid}>
              <div className={s.metaItem}>
                <span className={s.metaLabel}>교대</span>
                <span className={s.metaValue}>{win.label}{win.partial ? ' (진행 중 · 시작~지금)' : ' (완료)'}</span>
              </div>
              <div className={s.metaItem}>
                <span className={s.metaLabel}>집계 구간</span>
                <span className={s.metaValue}>{win.rangeLabel}</span>
              </div>
              <div className={s.metaItem}>
                <span className={s.metaLabel}>작성 시각</span>
                <span className={s.metaValue}>{report.builtAt}</span>
              </div>
              <div className={s.metaItem}>
                <span className={s.metaLabel}>다음 근무자에게</span>
                <span className={s.metaValue}>관리도 경보 · 전체 불량 개수</span>
              </div>
            </div>

            <div className={s.kpiRow} aria-label="교대 요약">
              <div className={s.kpi}>
                <span className={s.kpiLabel}>생산 샷 (구간)</span>
                <span className={s.kpiValue}>{report.totalShots.toLocaleString()}<span className={s.kpiUnit}>샷</span></span>
              </div>
              <div className={`${s.kpi} ${report.totalDefects > 0 ? s.kpiBad : ''}`}>
                <span className={s.kpiLabel}>전체 불량 개수 (1차+2차)</span>
                <span className={s.kpiValue}>{report.totalDefects.toLocaleString()}<span className={s.kpiUnit}>개</span></span>
              </div>
              <div className={`${s.kpi} ${report.totalAlarms > 0 ? s.kpiBad : ''}`}>
                <span className={s.kpiLabel}>관리도 경보</span>
                <span className={s.kpiValue}>{report.totalAlarms.toLocaleString()}<span className={s.kpiUnit}>건</span></span>
              </div>
            </div>

            <h3 className={s.sectionTitle}>① 라인별 불량</h3>
            <p className={s.sub}>
              합계 {report.totalDefects}개 = 1차 {report.totalFirst} + 2차 {report.totalSecond}
              {win.partial ? ' · 교대 종료 전이므로 지금까지 분만 집계' : ''}
            </p>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th scope="col">라인</th>
                    <th scope="col">샷</th>
                    <th scope="col">1차 불량</th>
                    <th scope="col">2차 불량</th>
                    <th scope="col">전체 불량</th>
                    <th scope="col">경보</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map(l => (
                    <tr key={l.line}>
                      <th scope="row">{LINE_LABEL[l.line] ?? l.line}</th>
                      <td className={s.num}>{l.shots.toLocaleString()}</td>
                      <td className={s.num}>{l.defects.first}</td>
                      <td className={s.num}>{l.defects.second}</td>
                      <td className={`${s.num} ${l.defects.final > 0 ? s.bad : ''}`}>{l.defects.final}</td>
                      <td className={`${s.num} ${l.alarms.length > 0 ? s.bad : ''}`}>{l.alarms.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className={s.sectionTitle}>② 관리도 경보 목록</h3>
            <p className={s.sub}>등급 「경보」만 · 주의·관찰 제외 · 발생 시각순</p>
            {report.totalAlarms === 0 ? (
              <p className={s.empty}>이 구간에 경보 없음</p>
            ) : (
              <ul className={s.alarmList}>
                {report.lines.flatMap(l => l.alarms.map(a => (
                  <li key={a.id} className={s.alarmCard}>
                    <div className={s.alarmHead}>{a.head}</div>
                    <p className={s.alarmTitle}>{a.title}</p>
                    {a.details.length > 0 && (
                      <ul className={s.alarmDetails}>
                        {a.details.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                    {a.guide && <p className={s.alarmGuide}>{a.guide}</p>}
                  </li>
                )))}
              </ul>
            )}

            <p className={s.footnote}>
              불량 = 품질 검사 「전체 불량 개수(1차+2차)」와 동일 규칙. 경보 = 공정 최적화 관리도 알림의 설비 한계 경보.
              데이터: JH casting API (실데이터).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
