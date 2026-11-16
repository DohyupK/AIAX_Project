'use client';
import { useEffect, useMemo, useState } from 'react';
import { LINES, USE_MOCK, fetchActiveModel, fetchShots, type Line } from '../../common/casting/api';
import MockShotImage from '../../common/casting/MockShotImage';
import type { ModelInfo, Shot } from '../../common/casting/types';
import { secondFail } from '../quality_inspection/inspection';
import {
  DEFECT_TYPES, emptyStore, loadStore, persistStore, saveLabel, sortByStatus, statusOf, toggleType, typesOf,
  type DefectCode, type LabelStatus, type LabelStore,
} from './labels';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './DefectLabeling.module.css';

const DATE = USE_MOCK ? '2021-10-07' : new Date().toISOString().slice(0, 10);
type Filter = 'all' | LabelStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'unlabeled', label: '미라벨' },
  { key: 'labeled', label: '라벨 완료' },
  { key: 'discarded', label: '폐기' },
];
const STATUS_TEXT: Record<LabelStatus, string> = { unlabeled: '미라벨', labeled: '라벨 완료', discarded: '폐기' };

/**
 * 불량 유형 라벨링 — 2차(DL) 검사에서 불량으로 판별된 샷 이미지 목록, 클릭 시 전문가 라벨링 팝업
 * 완료 → 라벨 테이블 저장 / UNDECIDABLE → 폐기 테이블로 이동 (목업: 브라우저 저장, labels.ts)
 */
export default function DefectLabeling() {
  const [line, setLine] = useState<Line>('line_no1');
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<LabelStore>(emptyStore);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<number | null>(null);

  // 저장된 라벨은 브라우저에서만 읽음 (서버 렌더와 어긋나지 않게 마운트 후)
  useEffect(() => setStore(loadStore()), []);

  useEffect(() => {
    let alive = true; // 라인을 빠르게 바꿀 때 이전 응답 무시
    setShots(null);
    setError(null);
    Promise.all([fetchShots(line, DATE), fetchActiveModel()])
      .then(([sh, m]) => { if (alive) { setShots(sh); setModel(m); } })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [line]);

  // 2차(DL) 불량 샷 — 최신순
  const defects = useMemo(
    () => (shots && model ? shots.filter(x => secondFail(x, model.threshold) === true).reverse() : []),
    [shots, model],
  );
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: defects.length, unlabeled: 0, labeled: 0, discarded: 0 };
    for (const d of defects) c[statusOf(store, line, d.shotId)]++;
    return c;
  }, [defects, store, line]);
  // 전체: 미라벨이 위, 라벨 완료·폐기는 아래 (라벨링할 샷부터 보이게)
  const visible = filter === 'all' ? sortByStatus(defects, store, line) : defects.filter(d => statusOf(store, line, d.shotId) === filter);
  const opened = openId != null ? defects.find(d => d.shotId === openId) ?? null : null;

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
            <select className={po.chipSelect} value={line} aria-label="라인 선택"
              onChange={e => { setLine(e.target.value as Line); setOpenId(null); }}>
              {LINES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <span className={po.chip}>일자 <b>{DATE}</b></span>
        </div>
      </header>

      {USE_MOCK && (
        <div className={po.banner}>
          목업: 2차(DL) 불량 판정은 실제 라벨 기반, 이미지는 목업입니다. 라벨은 이 브라우저에만 저장되며 다른 사람과 공유되지 않습니다 (DB 연결 전).
        </div>
      )}

      {error && <div className={po.errorBox} role="alert">데이터를 불러오지 못했습니다: {error}</div>}
      {!shots && !error && <div className={po.panel}>데이터를 불러오는 중입니다…</div>}
      {shots && !shots.length && !error && (
        <div className={`${po.panel} ${po.emptyLine}`} role="status">
          <b>{line}</b> 데이터가 아직 연결되지 않았습니다.
        </div>
      )}

      {shots && shots.length > 0 && (
        <section className={po.panel}>
          <div className={po.panelHead}>
            <h3>DL 불량 판정 샷 · {defects.length}건</h3>
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
                const st = statusOf(store, line, d.shotId);
                const types = typesOf(store, line, d.shotId);
                return (
                  <li key={d.shotId}>
                    <button type="button" className={`${s.card} ${s[`card_${st}`]}`} onClick={() => setOpenId(d.shotId)}
                      aria-label={`#${d.shotId} ${d.time} ${STATUS_TEXT[st]} — 라벨링 열기`}>
                      <MockShotImage shotId={d.shotId} defect className={s.thumb} />
                      <span className={s.cardMeta}>
                        <b className={po.num}>#{d.shotId}</b>
                        <span className={`${po.sub} ${po.num}`}>{d.time}</span>
                      </span>
                      <span className={`${s.badge} ${s[`badge_${st}`]}`}>
                        {st === 'labeled' ? types.join(' · ') : STATUS_TEXT[st]}
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

      {opened && model && (
        <LabelDialog key={opened.shotId} shot={opened} line={line}
          initial={typesOf(store, line, opened.shotId)} status={statusOf(store, line, opened.shotId)}
          onClose={() => setOpenId(null)}
          onSave={types => {
            const next = saveLabel(store, line, opened.shotId, types, new Date().toISOString());
            if (!persistStore(next)) return false; // 저장 실패 → 팝업 유지 + 안내
            setStore(next);
            setOpenId(null);
            return true;
          }} />
      )}
    </div>
  );
}

/** 라벨링 팝업 — 샷 이미지 + 불량 유형 선택, 완료 시 저장 */
function LabelDialog({ shot, line, initial, status, onClose, onSave }: {
  shot: Shot; line: string; initial: DefectCode[]; status: LabelStatus;
  onClose: () => void; onSave: (types: DefectCode[]) => boolean;
}) {
  const [selected, setSelected] = useState<DefectCode[]>(initial);
  const [failed, setFailed] = useState(false);

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
        <p className={po.sub}>{line} · {shot.time} · 2차(DL) 불량 판정</p>

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
                  onClick={() => { setSelected(sel => toggleType(sel, t.code)); setFailed(false); }}>
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
            {failed && <p className={s.errorNote} role="alert">저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.</p>}
            <div className={s.actions}>
              <button type="button" className={po.btn} onClick={onClose}>취소</button>
              <button type="button" className={s.doneBtn} disabled={!selected.length}
                onClick={() => setFailed(!onSave(selected))}>완료</button>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
