'use client';
import { useEffect, useMemo, useState } from 'react';
import MockShotImage from '../../common/casting/MockShotImage';
import {
  DEFECT_TYPES, fetchDefectDates, fetchDefects, sortByStatus, toggleType, typesOf,
  type DefectCode, type DefectShot, type LabelStatus,
} from './labels';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './DefectLabeling.module.css';

/** lake 에는 라인 칼럼이 없음 (원본이 전부 line_no1) */
const LINE = 'line_no1';
type Filter = 'all' | LabelStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'unlabeled', label: '미라벨' },
  { key: 'labeled', label: '라벨 완료' },
  { key: 'discarded', label: '폐기' },
];
const STATUS_TEXT: Record<LabelStatus, string> = { unlabeled: '미라벨', labeled: '라벨 완료', discarded: '폐기' };
const LOAD_ERROR = 'JH API 서버(127.0.0.1:8000)를 확인해 주세요.';

/**
 * 불량 유형 라벨링 — 그날 불량 샷 목록(lake), 클릭 시 전문가 라벨링 팝업
 * 라벨 상태는 ai.defect_label·ai.defect_discard 에서 읽음. 저장은 ai 쓰기 계정 연결 전이라 막혀 있음 (labels.ts)
 */
export default function DefectLabeling() {
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [shots, setShots] = useState<DefectShot[] | null>(null); // null = 불러오는 중
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);     // 팝업을 연 샷 casting_id

  // 처음: 불량 샷이 있는 날짜 → 가장 최근 날
  useEffect(() => {
    fetchDefectDates()
      .then(d => {
        setDates(d);
        if (d[0]) setDate(d[0]);
        else setShots([]);
      })
      .catch((e: Error) => {
        console.error('[defect_labeling] 날짜 조회 실패', e);
        setError(`${e.message} — ${LOAD_ERROR}`);
      });
  }, []);

  useEffect(() => {
    if (!date) return;
    let alive = true; // 날짜를 빠르게 바꿀 때 이전 응답 무시
    setShots(null);
    setError(null);
    setOpenId(null);
    fetchDefects(date)
      .then(sh => { if (alive) setShots(sh); })
      .catch((e: Error) => {
        console.error('[defect_labeling] 불량 샷 조회 실패', date, e);
        if (alive) setError(`${e.message} — ${LOAD_ERROR}`);
      });
    return () => { alive = false; };
  }, [date]);

  const defects = useMemo(() => shots ?? [], [shots]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: defects.length, unlabeled: 0, labeled: 0, discarded: 0 };
    for (const d of defects) c[d.status]++;
    return c;
  }, [defects]);
  // 전체: 미라벨이 위, 라벨 완료·폐기는 아래 (라벨링할 샷부터 보이게)
  const visible = filter === 'all' ? sortByStatus(defects) : defects.filter(d => d.status === filter);
  const opened = openId != null ? defects.find(d => d.castingId === openId) ?? null : null;

  return (
    <div className={po.page}>
      <header className={po.head}>
        <div>
          <div className={po.crumb}>주조 공정 대시보드 › 불량 유형 라벨링</div>
          <h2 className={po.title}>불량 유형 라벨링</h2>
        </div>
        <div className={po.chips}>
          <span className={po.chip}>라인 <b>{LINE}</b></span>
          <label className={po.chip}>
            일자
            <select className={po.chipSelect} value={date} aria-label="일자 선택" onChange={e => setDate(e.target.value)}>
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className={po.banner}>
        불량 샷은 서버 lake 공정 데이터의 실제 판정(passorfail = 1)이며, 이미지는 목업입니다 (DL 모델 연결 전).
        라벨 상태는 DB에서 읽어 오고, <b>저장은 DB 쓰기 계정 연결 전이라 아직 할 수 없습니다.</b>
      </div>

      {error && <div className={po.errorBox} role="alert">데이터를 불러오지 못했습니다: {error}</div>}
      {!shots && !error && <div className={po.panel}>데이터를 불러오는 중입니다…</div>}
      {shots && !shots.length && !error && (
        <div className={`${po.panel} ${po.emptyLine}`} role="status">
          <b>{date || LINE}</b> 불량 샷이 없습니다.
        </div>
      )}

      {shots && shots.length > 0 && (
        <section className={po.panel}>
          <div className={po.panelHead}>
            <h3>불량 샷 · {defects.length}건</h3>
            <div className={s.filters} role="group" aria-label="라벨 상태 필터">
              {FILTERS.map(f => (
                <button key={f.key} type="button" aria-pressed={filter === f.key}
                  className={`${s.filterBtn} ${filter === f.key ? s.filterOn : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label} <span className={po.num}>{counts[f.key]}</span>
                </button>
              ))}
            </div>
          </div>
          {visible.length ? (
            <ul className={s.grid}>
              {visible.map(d => {
                const st = d.status;
                return (
                  <li key={d.castingId}>
                    <button type="button" className={`${s.card} ${s[`card_${st}`]}`} onClick={() => setOpenId(d.castingId)}
                      aria-label={`#${d.shotId} ${d.time} ${STATUS_TEXT[st]} — 라벨링 열기`}>
                      <MockShotImage shotId={d.shotId} defect className={s.thumb} />
                      <span className={s.cardMeta}>
                        <b className={po.num}>#{d.shotId}</b>
                        <span className={`${po.sub} ${po.num}`}>{d.time}</span>
                      </span>
                      <span className={`${s.badge} ${s[`badge_${st}`]}`}>
                        {st === 'labeled' ? d.types.join(' · ') : STATUS_TEXT[st]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={po.sub}>해당 상태의 샷이 없습니다.</p>
          )}
        </section>
      )}

      {opened && <LabelDialog key={opened.castingId} shot={opened} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** 라벨링 팝업 — 샷 이미지 + 저장된 유형 표시. 유형은 골라 볼 수 있지만 저장(완료)은 쓰기 계정 연결 전이라 막힘 */
function LabelDialog({ shot, onClose }: { shot: DefectShot; onClose: () => void }) {
  const [selected, setSelected] = useState<DefectCode[]>(() => typesOf(shot));
  const status = shot.status;

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={po.backdrop} onClick={onClose}>
      <div className={`${po.dialog} ${s.dialog}`} role="dialog" aria-modal="true" aria-labelledby="label-title"
        onClick={e => e.stopPropagation()}>
        <div className={po.dialogHead}>
          <b id="label-title">불량 유형 라벨링 · <span className={po.num}>#{shot.shotId}</span></b>
          <span className={`${s.badge} ${s[`badge_${status}`]}`}>{STATUS_TEXT[status]}</span>
          <button type="button" className={po.closeBtn} onClick={onClose} aria-label="닫기">×</button>
        </div>
        <p className={po.sub}>{LINE} · {shot.time} · <span className={po.num}>{shot.castingId}</span> · 실제 판정 불량</p>

        <div className={s.body}>
          <div className={s.left}>
            <MockShotImage shotId={shot.shotId} defect className={s.image} />
          </div>
          <fieldset className={s.types}>
            <legend>불량 유형 <span className={po.sub}>(여러 개 선택 가능 · UNDECIDABLE 은 단독)</span></legend>
            {DEFECT_TYPES.map(t => {
              const on = selected.includes(t.code);
              return (
                <button key={t.code} type="button" aria-pressed={on}
                  className={`${s.typeBtn} ${on ? s.typeOn : ''} ${t.code === 'UNDECIDABLE' ? s.typeUndecidable : ''}`}
                  onClick={() => setSelected(sel => toggleType(sel, t.code))}>
                  <span className={s.check} aria-hidden="true">{on ? '✓' : ''}</span>
                  <span className={s.typeText}>
                    <b>{t.code}</b>
                    <small>{t.ko}</small>
                  </span>
                </button>
              );
            })}
            {selected.includes('UNDECIDABLE') && (
              <p className={s.warnNote}>완료하면 이 샷은 라벨 목록에서 빠지고 폐기 테이블로 이동합니다.</p>
            )}
            <p className={s.errorNote}>DB 쓰기 계정 연결 전이라 저장할 수 없습니다 (보기만 가능).</p>
            <div className={s.actions}>
              <button type="button" className={po.btn} onClick={onClose}>닫기</button>
              <button type="button" className={s.doneBtn} disabled title="DB 쓰기 계정 연결 전">완료</button>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
