import { useEffect, useMemo, useRef, useState } from 'react';
import { GRADE_NAME, GRADE_RANK, type AlertCard, type ControlLimits, type Grade } from '../../common/casting/alerts';
import s from './ProcessOptimization.module.css';

const MAX_OPEN = 50;            // 열린 알림 목록에 그리는 최대 카드 수 (나머지는 건수만)
const STORE_KEY = 'jh.process_optimization.closedAlertIds'; // 닫은 알림 카드 번호만 (닫은 사람·시각은 남기지 않음)
const GRADES: Grade[] = ['alarm', 'caution', 'watch'];
const GRADE_CLASS: Record<Grade, string> = { alarm: s.gAlarm, caution: s.gCaution, watch: s.gWatch };

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const short = (d: string) => d.slice(5); // 'YYYY-MM-DD' → 'MM-DD'

function loadClosed(): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch (e) {
    console.error('[process_optimization] 닫은 알림 기록을 읽지 못함', e);
    return new Set();
  }
}

/**
 * 관리도 알림 — 명세 6장. 열린 알림 카드(등급 순 → 최신 순) + 기록 요약(건수만) + 닫기
 * 닫기 = 담당 엔지니어가 설비에서 4줄 「확인할 곳」을 점검한 뒤. 원인·닫은 사람·닫은 시각은 받지 않음 (사용자 결정 2026-11-20)
 * 닫은 카드 번호만 이 브라우저(localStorage)에 남겨 새로고침해도 다시 뜨지 않게 함
 * 알림 소리는 넣지 않음 (사용자 결정 2026-11-20 — 명세의 경보·주의 소리 미적용)
 */
export default function AlertLog({ cards, limits, date }: {
  cards: AlertCard[]; limits: ControlLimits | null; date: string;
}) {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false); // 전체 알림 팝업
  const closeRef = useRef<HTMLButtonElement>(null);
  const listCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setClosed(loadClosed()); }, []);

  // 등급 순 → 같은 등급은 최신 순 (cards 는 시간순)
  const sorted = useMemo(
    () => cards.map((c, i) => ({ c, i }))
      .sort((a, b) => GRADE_RANK[b.c.grade] - GRADE_RANK[a.c.grade] || b.i - a.i).map(x => x.c),
    [cards],
  );
  const open = useMemo(() => sorted.filter(c => !closed.has(c.id)), [sorted, closed]);
  const current = openId ? cards.find(c => c.id === openId) ?? null : null;

  // 기록 요약: 최근 4시간(마지막 샷 시각 기준)·불러온 날짜 전체, 등급별 건수 (닫힌 알림 포함)
  const summary = useMemo(() => {
    const now = cards.length ? toMin(cards[cards.length - 1].time) : 0;
    const count = (list: AlertCard[]) => GRADES.map(g => list.filter(c => c.grade === g).length);
    return [
      { name: '최근 4시간', n: count(cards.filter(c => now - toMin(c.time) <= 240 && now >= toMin(c.time))) },
      { name: `${short(date)} 전체`, n: count(cards) },
    ];
  }, [cards, date]);

  // 팝업: 열리면 닫기 버튼에 포커스, Esc로 닫기 (상세가 전체 목록 위에 떠 있으면 상세만 닫음)
  useEffect(() => {
    if (!current && !listOpen) return;
    (current ? closeRef : listCloseRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (current) setOpenId(null);
      else setListOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, listOpen]);

  const closeAlert = (c: AlertCard) => {
    const next = new Set(closed).add(c.id);
    setClosed(next);
    setOpenId(null);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...next]));
    } catch (e) {
      console.error('[process_optimization] 닫은 알림 저장 실패', e);
    }
  };

  const judged = !!limits && !!date && date >= limits.judgeFrom;

  return (
    <div className={s.panel}>
      <div className={s.panelHead}>
        <h3>
          {judged
            ? <button type="button" className={s.headBtn} onClick={() => setListOpen(true)}>관리도 알림 <span className={s.sub}>전체 보기 ›</span></button>
            : '관리도 알림'}
        </h3>
        {limits && <span className={s.sub}>기준선: {limits.baselineFrom} ~ {short(limits.baselineTo)} 정상 양품 샷 · 판정 {short(limits.judgeFrom)}부터</span>}
      </div>

      {!limits && <p className={s.sub}>관리선을 불러오는 중…</p>}
      {limits && !judged && date && (
        <p className={s.sub}>알림은 {limits.judgeFrom}부터 판정합니다 ({date}는 기준 기간이거나 그 전).</p>
      )}

      {judged && (
        <>
          <table className={s.alertSummary}>
            <thead>
              <tr><th scope="col">기록</th>{GRADES.map(g => <th key={g} scope="col" className={GRADE_CLASS[g]}>{GRADE_NAME[g]}</th>)}</tr>
            </thead>
            <tbody>
              {summary.map(r => (
                <tr key={r.name}><th scope="row">{r.name}</th>{r.n.map((n, j) => <td key={j} className={s.num}>{n}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <p className={s.sub}>열린 알림 <b className={s.num}>{open.length}</b>건 · 닫힘 <span className={s.num}>{cards.length - open.length}</span>건 · 등급 순, 같은 등급은 최신 순</p>

          <ul className={s.alertList}>
            {open.length === 0 && <li className={s.sub}>열린 알림 없음</li>}
            {open.slice(0, MAX_OPEN).map(c => (
              <li key={c.id}>
                <button type="button" className={`${s.alertCard} ${GRADE_CLASS[c.grade]}`} onClick={() => setOpenId(c.id)}>
                  <span className={`${s.num} ${s.sub}`}>{c.head}</span>
                  <span className={s.alertTitle}>{c.title}</span>
                </button>
              </li>
            ))}
            {open.length > MAX_OPEN && <li className={s.sub}>외 {open.length - MAX_OPEN}건 (먼저 위 알림을 확인·닫으세요)</li>}
          </ul>
        </>
      )}

      {listOpen && (
        <div className={s.backdrop} onClick={() => setListOpen(false)}>
          <div className={`${s.dialog} ${s.dialogWide}`} role="dialog" aria-modal="true" aria-labelledby="alert-list-title" onClick={e => e.stopPropagation()}>
            <div className={s.dialogHead}>
              <h3 id="alert-list-title" className={s.dialogTitle}>관리도 알림 전체 · {short(date)}</h3>
              <button ref={listCloseRef} type="button" className={s.closeBtn} aria-label="전체 알림 닫기" onClick={() => setListOpen(false)}>×</button>
            </div>
            <p className={s.sub}>전체 <b className={s.num}>{cards.length}</b>건 (열림 {open.length} · 닫힘 {cards.length - open.length}) · 등급 순, 같은 등급은 최신 순</p>
            <ul className={`${s.alertList} ${s.alertListAll}`}>
              {sorted.length === 0 && <li className={s.sub}>알림 없음</li>}
              {sorted.map(c => {
                const done = closed.has(c.id);
                return (
                  <li key={c.id}>
                    <button type="button" className={`${s.alertCard} ${GRADE_CLASS[c.grade]} ${done ? s.alertDone : ''}`} onClick={() => setOpenId(c.id)}>
                      <span className={`${s.num} ${s.sub}`}>{c.head}{done && ' · 닫힘'}</span>
                      <span className={s.alertTitle}>{c.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {current && (
        <div className={s.backdrop} onClick={() => setOpenId(null)}>
          <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="alert-dialog-title" onClick={e => e.stopPropagation()}>
            <div className={s.dialogHead}>
              <span className={`${s.gradePill} ${GRADE_CLASS[current.grade]}`}>{GRADE_NAME[current.grade]}</span>
              <span className={`${s.num} ${s.sub}`}>{current.head.split(' · ').slice(1).join(' · ')}</span>
              <button ref={closeRef} type="button" className={s.closeBtn} aria-label="팝업 닫기" onClick={() => setOpenId(null)}>×</button>
            </div>
            <h3 id="alert-dialog-title" className={s.dialogTitle}>{current.title}</h3>
            <ul className={s.alertValues}>
              {current.details.map(d => <li key={d} className={s.num}>{d}</li>)}
            </ul>
            <p className={s.dialogBody}><b>확인할 곳</b> · {current.guide}</p>
            {current.extra && <p className={s.alertExtra}>{current.extra}</p>}

            <div className={s.closeForm}>
              {closed.has(current.id) ? <p className={s.sub}>닫힌 알림입니다.</p> : (
                <>
                  <p className={s.sub}>
                    {current.grade === 'watch' ? '관찰: 다음 점검 때 확인하세요.' : '경보·주의: 바로 설비에 가서 확인하세요.'}
                    {' '}「확인할 곳」을 직접 점검한 뒤 닫습니다.
                  </p>
                  <button type="button" className={s.btn} onClick={() => closeAlert(current)}>알림 닫기</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
