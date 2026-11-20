'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildHandoverReport, type HandoverReport } from './buildHandoverReport';
import HandoverDialog from './HandoverDialog';
import { autoHandoverWindow, currentShiftWindow, type ShiftWindow } from './shift';
import s from './ShiftHandover.module.css';

const STORE_KEY = 'jh.shift_handover.autoShown';

function loadShown(): Set<string> {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch (e) {
    console.error('[shift_handover] 자동 표시 기록 읽기 실패', e);
    return new Set();
  }
}

function markShown(key: string) {
  try {
    const next = loadShown();
    next.add(key);
    sessionStorage.setItem(STORE_KEY, JSON.stringify([...next]));
  } catch (e) {
    console.error('[shift_handover] 자동 표시 기록 저장 실패', e);
  }
}

/**
 * 교대 인수인계 — app/layout 전역 마운트
 * · 좌하단 「인수인계 실행」: 현재 교대(미완료면 시작~지금) 집계
 * · 교대 전환 후 30분: 직전 완료 교대 자동 팝업 (세션당 교대 키 1회)
 */
export default function ShiftHandover() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<HandoverReport | null>(null);
  const targetRef = useRef<ShiftWindow | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    setMounted(true);
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const run = useCallback(async (win: ShiftWindow) => {
    targetRef.current = win;
    setOpen(true);
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const r = await buildHandoverReport(win);
      if (!aliveRef.current || targetRef.current?.key !== win.key) return;
      setReport(r);
    } catch (e: unknown) {
      console.error('[shift_handover] 리포트 집계 실패', e);
      if (!aliveRef.current) return;
      setError(
        e instanceof Error && e.message
          ? `집계 실패: ${e.message}`
          : '집계에 실패했습니다. JH API 서버(127.0.0.1:8000)를 확인해 주세요.',
      );
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  const onManual = () => { void run(currentShiftWindow()); };
  const onRetry = () => {
    const w = targetRef.current ?? currentShiftWindow();
    void run(w);
  };
  const onClose = () => {
    setOpen(false);
    setError('');
  };

  // 교대 전환 직후 자동 오픈 — 마운트 시 + 1분마다 경계 창 확인
  useEffect(() => {
    const tryAuto = () => {
      const win = autoHandoverWindow();
      if (!win) return;
      if (loadShown().has(win.key)) return;
      markShown(win.key);
      void run(win);
    };
    tryAuto();
    const id = window.setInterval(tryAuto, 60_000);
    return () => window.clearInterval(id);
  }, [run]);

  if (!mounted) return null;

  return (
    <div className={s.wrap}>
      <button
        type="button"
        className={s.fab}
        onClick={onManual}
        disabled={open && loading}
        aria-haspopup="dialog"
      >
        인수인계 실행
      </button>
      {open && createPortal(
        <HandoverDialog
          report={report}
          loading={loading}
          error={error}
          onClose={onClose}
          onRetry={onRetry}
        />,
        document.body,
      )}
    </div>
  );
}
