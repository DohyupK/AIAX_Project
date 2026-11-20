import { useEffect, useMemo, useRef, useState } from 'react';
import { GRADE_NAME, GRADE_RANK, type AlertCard, type ControlLimits, type Grade } from '../../common/casting/alerts';
import { BADGE, BTN, CARD, CARD_HEAD, CARD_TITLE, CLOSE_BTN, FOCUS, MODAL_BACKDROP, MODAL_PANEL, SUB } from '../../common/ui';

const MAX_OPEN = 50;            // 열린 알림 목록에 그리는 최대 카드 수 (나머지는 건수만)
const STORE_KEY = 'jh.process_optimization.closedAlertIds'; // 닫은 알림 카드 번호만 (닫은 사람·시각은 남기지 않음)
const GRADES: Grade[] = ['alarm', 'caution', 'watch'];
// 경보 빨강 · 주의 주황 · 관찰 파랑 (명세 3장)
const GRADE_TEXT: Record<Grade, string> = {
  alarm: 'text-red-600 dark:text-red-400',
  caution: 'text-orange-600 dark:text-orange-400',
  watch: 'text-sky-600 dark:text-sky-400',
};
const GRADE_CARD: Record<Grade, string> = {
  alarm: 'border-red-500 bg-red-500/10 hover:bg-red-500/15',
  caution: 'border-orange-500 bg-orange-500/10 hover:bg-orange-500/15',
  watch: 'border-sky-500 bg-sky-500/10 hover:bg-sky-500/15',
};
const GRADE_BADGE: Record<Grade, string> = {
  alarm: 'bg-red-500/20 text-red-700 dark:text-red-400',
  caution: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  watch: 'bg-sky-500/20 text-sky-700 dark:text-sky-400',
};
const ALERT_CARD = `flex w-full flex-col gap-0.5 rounded-lg border-l-4 px-3 py-2 text-left transition phone:py-3 ${FOCUS}`;
const MONO = 'font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400';

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

  const alertButton = (c: AlertCard, done = false) => (
    <button type="button" className={`${ALERT_CARD} ${GRADE_CARD[c.grade]} ${done ? 'opacity-55' : ''}`} onClick={() => setOpenId(c.id)}>
      <span className={MONO}>{c.head}{done && ' · 닫힘'}</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.title}</span>
    </button>
  );

  return (
    <div className={CARD}>
      <header className={CARD_HEAD}>
        <h2 className={CARD_TITLE}>
          {judged
            ? (
              <button type="button" className={`hover:underline ${FOCUS}`} onClick={() => setListOpen(true)}>
                관리도 알림 <span className="text-sm font-medium text-brand-700 dark:text-brand-400">전체 보기 ›</span>
              </button>
            )
            : '관리도 알림'}
        </h2>
        {limits && <span className={SUB}>기준선: {limits.baselineFrom} ~ {short(limits.baselineTo)} 정상 양품 샷 · 판정 {short(limits.judgeFrom)}부터</span>}
      </header>

      <div className="p-5 phone:p-4">
        {!limits && <p className={SUB}>관리선을 불러오는 중…</p>}
        {limits && !judged && date && (
          <p className={SUB}>알림은 {limits.judgeFrom}부터 판정합니다 ({date}는 기준 기간이거나 그 전).</p>
        )}

        {judged && (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase dark:bg-gray-700/50 dark:text-gray-500">
                <tr>
                  <th scope="col" className="rounded-l-md px-2 py-1.5 text-left">기록</th>
                  {GRADES.map((g, j) => (
                    <th key={g} scope="col" className={`px-2 py-1.5 text-right ${GRADE_TEXT[g]} ${j === GRADES.length - 1 ? 'rounded-r-md' : ''}`}>{GRADE_NAME[g]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {summary.map(r => (
                  <tr key={r.name}>
                    <th scope="row" className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">{r.name}</th>
                    {r.n.map((n, j) => <td key={j} className="px-2 py-1.5 text-right font-semibold tabular-nums text-gray-800 dark:text-gray-100">{n}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`${SUB} mt-3`}>
              열린 알림 <b className="tabular-nums text-gray-800 dark:text-gray-100">{open.length}</b>건 · 닫힘 <span className="tabular-nums">{cards.length - open.length}</span>건 · 등급 순, 같은 등급은 최신 순
            </p>

            {/* 알림 약 3개 높이까지만 — 넘치면 스크롤 (알림이 늘어도 오른쪽 열이 공정 그림보다 길어지지 않게) */}
            <ul className="mt-2 flex max-h-[214px] flex-col gap-1.5 overflow-y-auto">
              {open.length === 0 && <li className={SUB}>열린 알림 없음</li>}
              {open.slice(0, MAX_OPEN).map(c => <li key={c.id}>{alertButton(c)}</li>)}
              {open.length > MAX_OPEN && <li className={SUB}>외 {open.length - MAX_OPEN}건 (먼저 위 알림을 확인·닫으세요)</li>}
            </ul>
          </>
        )}
      </div>

      {listOpen && (
        <div className={MODAL_BACKDROP} onClick={() => setListOpen(false)}>
          <div className={`${MODAL_PANEL} max-w-2xl`} role="dialog" aria-modal="true" aria-labelledby="alert-list-title" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <h3 id="alert-list-title" className="text-lg font-semibold text-gray-800 dark:text-gray-100">관리도 알림 전체 · {short(date)}</h3>
              <button ref={listCloseRef} type="button" className={CLOSE_BTN} aria-label="전체 알림 닫기" onClick={() => setListOpen(false)}>×</button>
            </div>
            <p className={`${SUB} mt-1`}>
              전체 <b className="tabular-nums text-gray-800 dark:text-gray-100">{cards.length}</b>건 (열림 {open.length} · 닫힘 {cards.length - open.length}) · 등급 순, 같은 등급은 최신 순
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {sorted.length === 0 && <li className={SUB}>알림 없음</li>}
              {sorted.map(c => <li key={c.id}>{alertButton(c, closed.has(c.id))}</li>)}
            </ul>
          </div>
        </div>
      )}

      {current && (
        <div className={MODAL_BACKDROP} onClick={() => setOpenId(null)}>
          <div className={MODAL_PANEL} role="dialog" aria-modal="true" aria-labelledby="alert-dialog-title" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className={`${BADGE} ${GRADE_BADGE[current.grade]}`}>{GRADE_NAME[current.grade]}</span>
              <span className={`${MONO} min-w-0 truncate`}>{current.head.split(' · ').slice(1).join(' · ')}</span>
              <button ref={closeRef} type="button" className={CLOSE_BTN} aria-label="팝업 닫기" onClick={() => setOpenId(null)}>×</button>
            </div>
            <h3 id="alert-dialog-title" className="mt-3 mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">{current.title}</h3>
            <ul className="list-disc pl-5 font-mono text-sm leading-7 text-gray-700 dark:text-gray-300">
              {current.details.map(d => <li key={d}>{d}</li>)}
            </ul>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-gray-600 dark:text-gray-300">
              <b className="text-gray-800 dark:text-gray-100">확인할 곳</b> · {current.guide}
            </p>
            {current.extra && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">{current.extra}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
              {closed.has(current.id) ? <p className={SUB}>닫힌 알림입니다.</p> : (
                <>
                  <p className={`${SUB} w-full`}>
                    {current.grade === 'watch' ? '관찰: 다음 점검 때 확인하세요.' : '경보·주의: 바로 설비에 가서 확인하세요.'}
                    {' '}「확인할 곳」을 직접 점검한 뒤 닫습니다.
                  </p>
                  <button type="button" className={`${BTN} phone:w-full`} onClick={() => closeAlert(current)}>알림 닫기</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
