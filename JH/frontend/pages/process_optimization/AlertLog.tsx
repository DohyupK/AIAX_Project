import { useEffect, useRef, useState } from 'react';
import { GUIDE, LABELS } from '../../common/casting/analysis';
import type { AlertItem } from '../../common/casting/analysis';
import s from './ProcessOptimization.module.css';

const MAX_ROWS = 7;

/** 알람 로그 — 항목 클릭 시 상세 팝업 (메인 대시보드 공지 팝업과 같은 동작: 바깥 클릭·Esc·× 로 닫기) */
export default function AlertLog({ alerts }: { alerts: AlertItem[] }) {
  const [open, setOpen] = useState<AlertItem | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 팝업: 열리면 닫기 버튼에 포커스, Esc로 닫기
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const guides = open ? [...new Set(open.keys.map(k => GUIDE[k]).filter(Boolean))] : [];

  return (
    <div className={s.panel}>
      <div className={s.panelHead}>
        <h3>알람 로그</h3>
        <span className={s.sub}>최근 순 · 클릭 시 상세</span>
      </div>
      <ul className={s.log}>
        {alerts.length === 0 && <li className={s.sub}>알람 없음</li>}
        {alerts.slice(0, MAX_ROWS).map((a, i) => (
          <li key={`${a.time}-${i}`}>
            <button type="button" className={s.logBtn} onClick={() => setOpen(a)}>
              <span className={`${s.num} ${s.sub}`}>{a.time}</span>
              <span className={`${s.sev} ${a.critical ? s.sevCritical : ''}`}>{a.message}</span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className={s.backdrop} onClick={() => setOpen(null)}>
          <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="alert-dialog-title" onClick={e => e.stopPropagation()}>
            <div className={s.dialogHead}>
              <span className={`${s.pill} ${open.critical ? s.pill_bad : s.pill_warn}`}>{open.critical ? '위험' : '주의'}</span>
              <span className={`${s.num} ${s.sub}`}>{open.time} · 샷 #{open.shotId}</span>
              <button ref={closeRef} type="button" className={s.closeBtn} aria-label="닫기" onClick={() => setOpen(null)}>×</button>
            </div>
            <h3 id="alert-dialog-title" className={s.dialogTitle}>{open.message}</h3>
            {open.keys.length > 0 && <p className={s.sub}>관련 변수: {open.keys.map(k => LABELS[k]).join(', ')}</p>}
            <p className={s.dialogBody}>{guides.length ? guides.join('\n') : '라인을 점검하고 최근 샷의 공정 변수를 확인하세요.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
