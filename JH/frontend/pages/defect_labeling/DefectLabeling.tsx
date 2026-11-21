'use client';
import { useEffect, useMemo, useState } from 'react';
import ShotImage from '../../common/casting/ShotImage';
import { LINES, type Line } from '../../common/casting/api';
import {
  DEFECT_TYPES, fetchDefectDates, fetchDefects, saveLabel, sortByStatus, toggleType, typesOf,
  type DefectCode, type DefectShot, type LabelStatus,
} from './labels';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './DefectLabeling.module.css';

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
 * 불량 유형 라벨링 — 그날 2차(DL) 판정 불량 샷 목록(ai.quality_prediction), 클릭 시 전문가 라벨링 팝업
 * 라벨 상태 SoT = JH/data/defect_labels.db (SQLite). 팝업 「완료」로 저장 (labels.ts saveLabel)
 */
export default function DefectLabeling() {
  const [line, setLine] = useState<Line>('line_no1'); // 기본 line_no1, 공정 최적화·품질 검사와 같은 라인 목록
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [shots, setShots] = useState<DefectShot[] | null>(null); // null = 불러오는 중
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);     // 팝업을 연 샷 casting_id

  // 라인을 고를 때마다: 그 라인의 불량 샷이 있는 날짜 → 가장 최근 날
  useEffect(() => {
    let alive = true; // 라인을 빠르게 바꿀 때 이전 응답 무시
    setDates([]);
    setDate('');
    setShots(null);
    setError(null);
    fetchDefectDates(line)
      .then(d => {
        if (!alive) return;
        setDates(d);
        if (d[0]) setDate(d[0]);
        else setShots([]);
      })
      .catch((e: Error) => {
        console.error('[defect_labeling] 날짜 조회 실패', line, e);
        if (alive) setError(`${e.message} — ${LOAD_ERROR}`);
      });
    return () => { alive = false; };
  }, [line]);

  useEffect(() => {
    if (!date) return;
    let alive = true; // 날짜를 빠르게 바꿀 때 이전 응답 무시
    setShots(null);
    setError(null);
    setOpenId(null);
    fetchDefects(line, date)
      .then(sh => { if (alive) setShots(sh); })
      .catch((e: Error) => {
        console.error('[defect_labeling] 불량 샷 조회 실패', line, date, e);
        if (alive) setError(`${e.message} — ${LOAD_ERROR}`);
      });
    return () => { alive = false; };
  }, [line, date]);

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
          <label className={po.chip}>
            라인
            <select className={po.chipSelect} value={line} aria-label="라인 선택" onChange={e => setLine(e.target.value as Line)}>
              {LINES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className={po.chip}>
            일자
            <select className={po.chipSelect} value={date} aria-label="일자 선택" onChange={e => setDate(e.target.value)}>
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className={po.banner}>
        불량 샷은 2차(DL) 검사에서 불량으로 판정된 샷이며(품질 검사 화면에서 판정·저장), 사진은 서버 이미지 API에서 불러옵니다.
        유형을 고르고 <b>완료</b>를 누르면 서버(SQLite)에 저장됩니다.
      </div>

      {error && <div className={po.errorBox} role="alert">데이터를 불러오지 못했습니다: {error}</div>}
      {!shots && !error && <div className={po.panel}>데이터를 불러오는 중입니다…</div>}
      {shots && !shots.length && !error && (
        <div className={`${po.panel} ${po.emptyLine}`} role="status">
          <b>{line}{date && ` · ${date}`}</b> 불량 샷이 없습니다.
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
                      <ShotImage castingId={d.castingId} className={s.thumb} />
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

      {opened && (
        <LabelDialog key={opened.castingId} line={line} shot={opened} onClose={() => setOpenId(null)}
          onSaved={saved => {
            // 저장 성공 → 그 샷 상태만 바꾸고 팝업 닫기 (목록 재조회 없음)
            setShots(sh => sh && sh.map(d => (d.castingId === opened.castingId ? { ...d, ...saved } : d)));
            setOpenId(null);
          }} />
      )}
    </div>
  );
}

/** 라벨링 팝업 — 샷 이미지 + 유형 선택 → 「완료」로 저장 */
function LabelDialog({ line, shot, onClose, onSaved }: {
  line: Line; shot: DefectShot; onClose: () => void;
  onSaved: (saved: Pick<DefectShot, 'status' | 'types'>) => void;
}) {
  const [selected, setSelected] = useState<DefectCode[]>(() => typesOf(shot));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const status = shot.status;

  const save = () => {
    setSaving(true);
    setSaveError(null);
    saveLabel(shot.castingId, selected)
      .then(onSaved)
      .catch((e: Error) => {
        console.error('[defect_labeling] 라벨 저장 실패', shot.castingId, selected, e);
        setSaveError(e.message);
        setSaving(false);
      });
  };

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
        <p className={po.sub}>{line} · {shot.time} · <span className={po.num}>{shot.castingId}</span> · 2차 판정 불량</p>

        <div className={s.body}>
          <div className={s.left}>
            <ShotImage castingId={shot.castingId} className={s.image} />
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
            {saveError && <p className={s.errorNote} role="alert">저장하지 못했습니다: {saveError}</p>}
            <div className={s.actions}>
              <button type="button" className={po.btn} onClick={onClose}>닫기</button>
              <button type="button" className={s.doneBtn} disabled={saving || !selected.length} onClick={save}>
                {saving ? '저장 중…' : '완료'}
              </button>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
