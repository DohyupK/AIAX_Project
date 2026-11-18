'use client';
import { useEffect, useMemo, useState } from 'react';
import { LINES, fetchActiveModel, fetchDates, fetchMlModel, type Line } from '../../common/casting/api';
import { useShotStream } from '../../common/casting/useShotStream';
import type { MlModel, ModelInfo, Shot } from '../../common/casting/types';
import SensorMonitor from '../process_optimization/SensorMonitor';
import { fetchDeployedModel, type Model } from '../model_management/data';
import KeyVariables from './KeyVariables';
import ProbChart from './ProbChart';
import { DL_CONNECTED, confusion, firstFail, rate } from './inspection';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './QualityInspection.module.css';

const pct = (v: number | null) => (v == null ? '—' : v.toFixed(1));
/** 0~1 비율 → '69.0' (null 이면 —) */
const pct1 = (v: number | null | undefined) => (v == null ? '—' : (v * 100).toFixed(1));
/** 모델 학습 라인 — 다른 라인은 학습한 적 없는 데이터라 안내 */
const TRAINED_LINE = 'line_no1';
const DL_PENDING = 'DL 모델 연결 전';
/** 샷 고유키 — shotId(생산번호)는 하루 안에서 중복될 수 있어 casting_id 우선 */
const keyOf = (x: Shot) => x.castingId ?? String(x.shotId);
type ListFilter = 'all' | 'first' | 'defect' | 'missed';
const LIST_FILTERS: { key: ListFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'first', label: '1차 불량' },
  { key: 'defect', label: '실제 불량' },
  { key: 'missed', label: '놓친 불량 (1차 양품·실제 불량)' },
];

/**
 * 품질 검사 대시보드 — 1차 검사(ML) 후 1차 양품 샷만 2차 검사(DL). 최종 불량 = 1차 불량 + 2차 불량
 * 1차 = 샷 점수(prob, TM 배포 모델 DieCasting_XGB_20261114_09) ≥ 기준값. 실제 판정(passorfail)과 비교해 보여 줌
 * 모델 = Model Management 배포 모델 (1차 = 「품질 1차 검사」, 2차 = 「품질 2차 검사」 — 2차는 이름만, DL 실행은 연결 후)
 * 2차 = DL 모델 연결 전 (inspection.ts DL_CONNECTED). 정상 범위는 목업 model.json (공정 변수 모니터와 같은 기준)
 */
export default function QualityInspectionDashboard() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [ml, setMl] = useState<MlModel | null>(null); // 1차 검사 모델 (점수 기준값·검증 성적)
  const [dl, setDl] = useState<Model | null | undefined>(undefined); // 2차 배포 모델 (undefined = 조회 전, null = 없음)
  const [metaError, setMetaError] = useState<string | null>(null);
  const [mlOpen, setMlOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [line, setLine] = useState<Line>('line_no1'); // 라인 선택 (「전체」 없음)
  const [dates, setDates] = useState<string[] | null>(null); // null = 조회 전
  const [date, setDate] = useState(''); // 기본: 데이터가 있는 가장 최근 날짜

  // 공정 최적화와 같은 실데이터 스트림 — 고른 날짜를 처음부터 재생. 팝업이 열리면 멈춤 (표가 틱마다 다시 그려지지 않게)
  // shots = 지금까지 재생한 샷 (그래프·목록), day = 받아 온 하루치 전체 (KPI·1차 집계)
  const { shots, all: day, loading, error: streamError, retry, finished, restart } = useShotStream(line, date, playing && !mlOpen, true);

  const loadModels = () => {
    fetchActiveModel().then(setModel).catch((e: Error) => setMetaError(e.message));
    fetchMlModel().then(setMl).catch((e: Error) => setMetaError(`1차 검사 모델: ${e.message}`));
    // 2차는 표시용 — 실패해도 화면은 계속 (콘솔에만)
    fetchDeployedModel('qc2').then(setDl).catch((e: unknown) => { console.error('[quality_inspection] 2차 배포 모델 조회 실패', e); setDl(null); });
  };
  useEffect(loadModels, []);
  const loadDates = (l: Line) => {
    let alive = true;
    setDates(null);
    fetchDates(l)
      .then(ds => { if (alive) { setDates(ds); setDate(d => (ds.includes(d) ? d : ds[0] ?? '')); } })
      .catch((e: Error) => { if (alive) setMetaError(e.message); });
    return () => { alive = false; };
  };
  useEffect(() => loadDates(line), [line]);
  useEffect(() => { if (finished) setPlaying(false); }, [finished]);
  useEffect(() => { setMlOpen(false); }, [line, date]);

  const error = streamError ?? metaError;
  const reload = () => {
    setMetaError(null);
    if (!dates?.length) loadDates(line);
    retry();
    if (!model || !ml) loadModels();
  };
  const togglePlay = () => {
    if (!playing && finished) restart();
    setPlaying(p => !p);
  };

  const th = ml?.threshold ?? 1;
  // 집계는 하루 전체 기준 — 재생 초반에 1차 불량이 아직 안 나와 0으로 보이는 문제 방지
  const first = useMemo(() => day.filter(x => firstFail(x, th)).length, [day, th]);
  const firstSoFar = useMemo(() => shots.filter(x => firstFail(x, th)).length, [shots, th]);
  // 1차 판정 vs 실제 판정 — 하루 전체 기준
  const cm = useMemo(() => confusion(day, th), [day, th]);
  const secondTargets = day.length - first;
  const replayNote = `재생 ${shots.length.toLocaleString()}/${day.length.toLocaleString()}샷 · 지금까지 1차 불량 ${firstSoFar}개`;
  const latest = shots[shots.length - 1];

  return (
    <div className={po.page}>
      <header className={po.head}>
        <div>
          <div className={po.crumb}>주조 공정 대시보드 › 품질 검사</div>
          <h2 className={po.title}>품질 검사 대시보드</h2>
        </div>
        <div className={po.chips}>
          <label className={po.chip}>
            라인
            <select className={po.chipSelect} value={line} aria-label="라인 선택"
              onChange={e => setLine(e.target.value as Line)}>
              {LINES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className={po.chip}>
            날짜
            <select className={po.chipSelect} value={date} aria-label="날짜 선택" disabled={!dates?.length}
              onChange={e => { setDate(e.target.value); setPlaying(true); }}>
              {dates?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          {ml && <span className={po.chip}>1차 기준값 <b className={po.num}>{ml.threshold.toFixed(3)}</b></span>}
          <span className={po.chip}>
            <span className={`${po.dot} ${playing ? po.dotLive : ''}`} />
            <b>{playing ? '실시간' : finished ? '재생 종료' : '일시정지'}</b>
            {latest && <span className={po.num}>· {latest.time}</span>}
          </span>
          <button type="button" className={po.btn} onClick={togglePlay}>{playing ? '일시정지' : '재생'}</button>
        </div>
      </header>

      <div className={po.banner}>
        실데이터(공정 DB): 고른 날짜의 샷을 처음부터 재생합니다. 1차(ML) 검사는 모델 점수가 기준값 이상이면 불량으로 판정하고
        실제 판정(passorfail)과 비교합니다. 2차(DL) 검사는 {DL_PENDING}이라 최종 불량은 지금 1차 기준입니다.
        {ml && line !== TRAINED_LINE && <><br /><b>주의:</b> 1차 모델은 {TRAINED_LINE} 데이터로만 학습했습니다. {line} 결과는 참고용입니다.</>}
      </div>

      {error && (
        <div className={po.errorBox} role="alert">
          <span>데이터를 불러오지 못했습니다: {error}</span>
          <button type="button" className={po.btn} onClick={reload}>다시 시도</button>
        </div>
      )}

      {/* 셸(헤더·배너)은 유지하고 데이터 영역만 상태 표시 */}
      {(dates === null || !model || !ml) && !error && <div className={po.panel}>데이터를 불러오는 중입니다…</div>}
      {loading && !!date && !shots.length && !error && <div className={po.panel}>샷 데이터를 불러오는 중입니다…</div>}
      {(dates?.length === 0 || (!loading && date && !shots.length)) && !error && (
        <div className={`${po.panel} ${po.emptyLine}`} role="status">
          <b>{line}</b> 데이터가 아직 연결되지 않았습니다.
          <span className={po.sub}>라인 설비 데이터가 연결되면 1차·2차 검사 결과와 공정 변수가 표시됩니다.</span>
        </div>
      )}

      {/* 모델만 있으면 KPI·카드 골격 표시 — 샷 0건이어도 레이아웃 유지 */}
      {model && ml && (
        <>
          <section className={`${po.grid} ${s.kpis3}`} aria-label="품질 요약 지표">
            <Kpi label="전체 생산 샷 (하루)" value={day.length.toLocaleString()} unit="샷" note={`재생 ${shots.length.toLocaleString()}샷`} />
            <Kpi label={DL_CONNECTED ? '최종 불량률' : '최종 불량률 (2차 연결 전 · 1차 기준)'}
              value={pct(rate(first, day.length))} unit="%" bad={first > 0} note="하루 전체 기준" />
            <Kpi label={DL_CONNECTED ? '전체 불량 개수' : '전체 불량 개수 (1차 기준)'} value={String(first)} unit="개" bad={first > 0}
              note={replayNote} />
          </section>

          <section className={`${po.grid} ${s.models}`}>
            <button type="button" className={`${po.panel} ${s.modelCard}`} onClick={() => setMlOpen(true)}>
              <span className={s.modelHead}><b>ML 모델 · 1차 검사</b><span className={po.sub}>누르면 샷 목록</span></span>
              <ModelStats label="1차" n={first} rateV={rate(first, day.length)} base={`하루 전체 ${day.length.toLocaleString()}샷 기준 · ${replayNote}`} />
              <span className={po.sub}>
                모델 <b>{ml.name}{ml.version && ` ${ml.version}`}</b>
                {ml.source === 'registry' ? ' · Model Management 「품질 1차 검사」 배포 모델' : ' · 레지스트리 미등록 — 기본 모델'}
              </span>
              <span className={s.cardSection}>
                <span className={po.sub}>실제 판정과 비교 (하루 전체 기준)</span>
                <span className={s.stats}>
                  <Stat label="맞힌 불량 / 놓친 불량" value={`${cm.tp} / ${cm.fn} 개`} />
                  <Stat label="잘못 경보" value={`${cm.fp} 개`} />
                  <Stat label="Recall (불량 중 잡은 비율)" value={`${pct1(cm.recall)} %`} />
                  <Stat label="Precision (경보 중 실제 불량)" value={`${pct1(cm.precision)} %`} />
                </span>
                <span className={po.sub}>
                  TM 검증 성적 Recall {pct1(ml.test.Recall)}% / Precision {pct1(ml.test.Precision)}%
                  {cm.unjudged > 0 && ` · 실제 판정 없는 ${cm.unjudged}샷 비교 제외`}
                </span>
              </span>
              <span className={s.cardSection}>
                <span className={po.sub}>1차 불량 점수 · 최근 60샷 · 빨간 점선 = 기준값 (점수는 확률이 아님)</span>
                <ProbChart shots={shots} threshold={ml.threshold} />
              </span>
            </button>
            <div className={`${po.panel} ${s.modelCard}`}>
              <span className={s.modelHead}><b>DL 모델 · 2차 검사</b><span className={po.sub}>1차 양품 샷만 검사</span></span>
              <span className={s.modelBody}>
                <span className={s.stats}>
                  <Stat label="2차 불량률" value="— %" />
                  <Stat label="2차 불량 개수" value="— 개" />
                </span>
                <span className={po.sub}>1차 양품 {secondTargets}샷이 2차 대상 · {DL_PENDING}</span>
                <span className={po.sub}>
                  {dl === undefined ? '배포 모델 조회 중…'
                    : dl ? <>배포 모델 <b>{dl.name} {dl.version}</b> (Model Management 「품질 2차 검사」)</>
                    : 'Model Management 「품질 2차 검사」에 배포된 모델 없음'}
                </span>
              </span>
              <span className={s.cardSection}>
                <span className={po.sub}>실시간 2차 분석 · 최근 2차 불량 샷</span>
                <span className={s.slot}>{DL_PENDING} — 연결되면 샷 이미지 분석 결과가 표시됩니다</span>
              </span>
            </div>
          </section>

          <SensorMonitor shots={shots} model={model} />

          {/* 팝업도 하루 전체 기준 — 재생 진행과 무관하게 그날 샷 전부 */}
          {mlOpen && <MlDialog shots={day} model={model} ml={ml} first={first} onClose={() => setMlOpen(false)} />}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, bad, note }: { label: string; value: string; unit: string; bad?: boolean; note?: string }) {
  return (
    <div className={`${po.panel} ${po.kpi} ${bad ? po.kpi_bad : ''}`}>
      <span className={po.kpiLabel}>{label}</span>
      <span className={`${po.kpiValue} ${po.num}`}>{value}<small>{unit}</small></span>
      {note && <span className={po.sub}>{note}</span>}
    </div>
  );
}

function ModelStats({ label, n, rateV, base }: { label: string; n: number; rateV: number | null; base: string }) {
  return (
    <span className={s.modelBody}>
      <span className={s.stats}>
        <Stat label={`${label} 불량률`} value={`${pct(rateV)} %`} />
        <Stat label={`${label} 불량 개수`} value={`${n} 개`} />
      </span>
      <span className={po.sub}>{base}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className={s.stat}>
      <span className={po.sub}>{label}</span>
      <b className={po.num}>{value}</b>
    </span>
  );
}

/** 샷 목록 팝업 (하루 전체 샷) — 좌: 1차 점수·판정과 실제 판정 / 우: 선택 샷의 2차(DL) 칸 + 주요 변수 */
function MlDialog({ shots, model, ml, first, onClose }: {
  shots: Shot[]; model: ModelInfo; ml: MlModel; first: number; onClose: () => void;
}) {
  const th = ml.threshold;
  const [filter, setFilter] = useState<ListFilter>('all');
  // 최근 샷이 위로
  const list = useMemo(() => {
    const keep = (x: Shot) =>
      filter === 'all' ? true
      : filter === 'first' ? firstFail(x, th)
      : filter === 'defect' ? x.actual === 1
      : x.actual === 1 && !firstFail(x, th);
    return shots.filter(keep).reverse();
  }, [shots, filter, th]);
  const [selectedId, setSelectedId] = useState<string | null>(() => (shots.length ? keyOf(shots[shots.length - 1]) : null));
  const selected = shots.find(x => keyOf(x) === selectedId) ?? null;

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={po.backdrop} onClick={onClose}>
      <div className={`${po.dialog} ${s.dialog}`} role="dialog" aria-modal="true" aria-label="1차 검사 샷 목록"
        onClick={e => e.stopPropagation()}>
        <div className={po.dialogHead}>
          <b>1차 검사(ML) · 2차 검사(DL)</b>
          <button type="button" className={po.closeBtn} onClick={onClose} aria-label="닫기" autoFocus>×</button>
        </div>

        <div className={s.split}>
          <section className={s.col}>
            <div className={s.stats}>
              <Stat label="1차 불량률 (하루 전체)" value={`${pct(rate(first, shots.length))} %`} />
              <Stat label="1차 불량 개수 (하루 전체)" value={`${first} 개`} />
            </div>
            <div className={s.toolbar}>
              <span className={po.sub}>최근 순 · {list.length}건</span>
              <select className={po.btn} value={filter} aria-label="필터" onChange={e => setFilter(e.target.value as ListFilter)}>
                {LIST_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <div className={s.list}>
              <table className={s.table}>
                <thead><tr><th>샷</th><th>시각</th><th>1차 점수</th><th>1차</th><th>실제</th></tr></thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr><td colSpan={5} className={po.sub}>표시할 샷이 없습니다</td></tr>
                  ) : list.map(x => {
                    const fail = firstFail(x, th);
                    return (
                      <tr key={keyOf(x)} className={keyOf(x) === selectedId ? s.rowSelected : ''} onClick={() => setSelectedId(keyOf(x))}>
                        <td>
                          <button type="button" className={s.rowBtn} aria-pressed={keyOf(x) === selectedId}
                            onClick={() => setSelectedId(keyOf(x))}>#{x.shotId}</button>
                        </td>
                        <td className={po.num}>{x.time}</td>
                        <td className={po.num}>{x.prob.toFixed(3)}</td>
                        <td><span className={`${po.pill} ${fail ? po.pill_bad : po.pill_ok}`}>{fail ? '불량' : '양품'}</span></td>
                        <td>
                          {x.actual == null
                            ? <span className={po.sub}>미판정</span>
                            : <span className={`${po.pill} ${x.actual ? po.pill_bad : po.pill_ok}`}>{x.actual ? '불량' : '양품'}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={s.col}>
            <div className={s.stats}>
              <Stat label="2차 불량률" value="— %" />
              <Stat label="2차 불량 개수" value="— 개" />
            </div>
            {selected ? <ShotAnalysis shot={selected} model={model} th={th} /> : <div className={s.slot}>샷을 선택하세요</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

/** 선택 샷 — 1차 결과 + 2차(DL) 칸 + 주요 변수 */
function ShotAnalysis({ shot, model, th }: { shot: Shot; model: ModelInfo; th: number }) {
  const fail = firstFail(shot, th);
  return (
    <>
      <span className={po.sub}>
        #{shot.shotId} · {shot.time} · 1차 점수 <span className={po.num}>{shot.prob.toFixed(3)}</span> ({fail ? '불량' : '양품'})
        {' '}· 실제 {shot.actual === 1 ? '불량' : shot.actual === 0 ? '양품' : '미판정'}
      </span>
      <div className={s.slot}>
        {fail ? `#${shot.shotId} · 1차 불량 확정 — 2차 검사 대상 아님` : `2차(DL) 검사 대상 · ${DL_PENDING}`}
      </div>
      <KeyVariables shot={shot} model={model} />
    </>
  );
}
