'use client';
import { useEffect, useMemo, useState } from 'react';
import { LINES, fetchActiveModel, fetchDates, fetchMlModel, fetchSecond, type Line } from '../../common/casting/api';
import { useShotStream } from '../../common/casting/useShotStream';
import ShotImage from '../../common/casting/ShotImage';
import type { MlModel, ModelInfo, SecondCheck, SecondResult, Shot } from '../../common/casting/types';
import SensorMonitor from '../process_optimization/SensorMonitor';
import KeyVariables from './KeyVariables';
import ProbChart from './ProbChart';
import { confusion, firstFail, rate, secondOf, summarize, type InspectionSummary, type SecondMap } from './inspection';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './QualityInspection.module.css';

const pct = (v: number | null) => (v == null ? '—' : v.toFixed(1));
/** 0~1 비율 → '69.0' (null 이면 —) */
const pct1 = (v: number | null | undefined) => (v == null ? '—' : (v * 100).toFixed(1));
/** 모델 학습 라인 — 다른 라인은 학습한 적 없는 데이터라 안내 */
const TRAINED_LINE = 'line_no1';
const NO_RESULTS: SecondMap = new Map();
/** 2차 결과 한 줄 — 「불량 0.835」 */
const secondLabel = (r: SecondResult) => `${r.result === 'fail' ? '불량' : '양품'} ${r.confidenceScore.toFixed(3)}`;
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
 * 모델 = Model Management 배포 모델 (1차 = 「품질 1차 검사」, 2차 = 「품질 2차 검사」, 없으면 각 기본 모델)
 * 2차 = 샷 이미지(mes.casting_image)를 DL 모델로 판정 — 이미지가 없는 샷은 「이미지 없음」. 정상 범위는 목업 model.json
 */
export default function QualityInspectionDashboard() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [ml, setMl] = useState<MlModel | null>(null); // 1차 검사 모델 (점수 기준값·검증 성적)
  const [second, setSecond] = useState<SecondCheck | null>(null); // 2차(DL) 판정 — 그날 그 라인 (null = 조회 중)
  const [secondError, setSecondError] = useState<string | null>(null);
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
  };
  useEffect(loadModels, []);
  // 2차(DL) — 실패해도 1차 화면은 계속 (2차 카드에만 안내)
  const loadSecond = () => {
    if (!date) return;
    let alive = true;
    setSecond(null);
    setSecondError(null);
    fetchSecond(line, date)
      .then(r => { if (alive) setSecond(r); })
      .catch((e: Error) => {
        console.error('[quality_inspection] 2차 검사 조회 실패', e);
        if (alive) setSecondError(e.message);
      });
    return () => { alive = false; };
  };
  useEffect(loadSecond, [line, date]);
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
    if (secondError) loadSecond();
  };
  const togglePlay = () => {
    if (!playing && finished) restart();
    setPlaying(p => !p);
  };

  const th = ml?.threshold ?? 1;
  // castingId → 판정 결과 / 'pending'(사진 있음·서버 판정 전) — 「이미지 없음」과 구분
  const results: SecondMap = useMemo(() => (second
    ? new Map<string, SecondResult | 'pending'>([
        ...second.pendingIds.map(id => [id, 'pending'] as const),
        ...second.results.map(r => [r.castingId, r] as const),
      ])
    : NO_RESULTS), [second]);
  // 집계는 하루 전체 기준 — 재생 초반에 1차 불량이 아직 안 나와 0으로 보이는 문제 방지
  const sum = useMemo(() => summarize(day, th, results), [day, th, results]);
  const first = sum.first;
  const firstSoFar = useMemo(() => shots.filter(x => firstFail(x, th)).length, [shots, th]);
  // 1차 판정 vs 실제 판정 — 하루 전체 기준
  const cm = useMemo(() => confusion(day, th), [day, th]);
  // 최근 2차 불량 샷 (하루 전체 중 1차 양품·DL 불량, 최근 순 5개)
  const recentSecondFails = useMemo(
    () => day.flatMap(x => { const st = secondOf(x, th, results); return typeof st === 'object' && st.result === 'fail' ? [{ shot: x, r: st }] : []; })
      .slice(-5).reverse(),
    [day, th, results],
  );
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
        실제 판정(passorfail)과 비교합니다. 2차(DL) 검사는 1차 양품 샷의 이미지를 DL 모델로 판정하며(불량 확률 0.5 이상 불량),
        이미지가 없는 샷은 2차 판정 없이 양품으로 셉니다. 최종 불량 = 1차 불량 + 2차 불량.
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
            <Kpi label="최종 불량률 (1차 + 2차)" value={pct(rate(sum.final, day.length))} unit="%" bad={sum.final > 0}
              note={second ? `하루 전체 기준 · 2차는 판정 끝난 ${sum.inspected}샷만${sum.pending ? ` (판정 대기 ${sum.pending}샷)` : ''}` : '하루 전체 기준 · 2차 조회 중이면 1차만'} />
            <Kpi label="전체 불량 개수 (1차 + 2차)" value={String(sum.final)} unit="개" bad={sum.final > 0}
              note={`1차 ${first} + 2차 ${sum.second} · ${replayNote}`} />
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
              <ModelStats label="2차" n={sum.second} rateV={rate(sum.second, sum.inspected)} waiting={sum.pending}
                base={`1차 양품 ${sum.secondTargets.toLocaleString()}샷 중 판정 ${sum.inspected.toLocaleString()}샷 · 판정 대기 ${sum.pending.toLocaleString()}샷 · 이미지 없음 ${(sum.secondTargets - sum.inspected - sum.pending).toLocaleString()}샷`} />
              <span className={po.sub}>
                {secondError ? <span role="alert">2차 검사를 불러오지 못했습니다: {secondError}</span>
                  : !second ? '2차 검사 결과 불러오는 중…'
                  : <>모델 <b>{second.model.name}{second.model.version && ` ${second.model.version}`}</b>
                    {second.model.source === 'registry' ? ' · Model Management 「품질 2차 검사」 배포 모델' : ' · 레지스트리 미등록 — 기본 모델 (판정 저장 안 됨)'}
                    {second.pending > 0 && <> · <b>판정 대기 {second.pending.toLocaleString()}장</b> (서버가 순서대로 판정 중 — 새로고침하면 반영)</>}</>}
              </span>
              <span className={s.cardSection}>
                <span className={po.sub}>최근 2차 불량 샷 (하루 전체 · 불량 확률)</span>
                {recentSecondFails.length === 0
                  ? <span className={s.slot}>{second ? '2차 불량 샷이 없습니다' : '—'}</span>
                  : <span className={s.stats}>
                      {/* 썸네일 = 촬영 사진 미리보기 (크게 보기는 샷 목록 팝업) */}
                      {recentSecondFails.map(({ shot, r }) => (
                        <span key={r.castingId} className={`${s.stat} ${s.statThumb}`}>
                          <ShotImage castingId={r.castingId} className={s.thumb} />
                          <span className={s.statText}>
                            <span className={po.sub}>#{shot.shotId} · {shot.time}</span>
                            <b className={po.num}>{secondLabel(r)}</b>
                          </span>
                        </span>
                      ))}
                    </span>}
              </span>
            </div>
          </section>

          <SensorMonitor shots={shots} model={model} />

          {/* 팝업도 하루 전체 기준 — 재생 진행과 무관하게 그날 샷 전부 */}
          {mlOpen && <MlDialog shots={day} model={model} ml={ml} sum={sum} results={results} onClose={() => setMlOpen(false)} />}
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

/** waiting = 판정 대기 수 — 판정 끝난 샷이 없고 대기만 있으면 「— %」 대신 「판정 대기」 */
function ModelStats({ label, n, rateV, base, waiting = 0 }: { label: string; n: number; rateV: number | null; base: string; waiting?: number }) {
  const onlyWaiting = rateV == null && waiting > 0;
  return (
    <span className={s.modelBody}>
      <span className={s.stats}>
        <Stat label={`${label} 불량률`} value={onlyWaiting ? '판정 대기' : `${pct(rateV)} %`} />
        <Stat label={`${label} 불량 개수`} value={onlyWaiting ? `대기 ${waiting.toLocaleString()}장` : `${n} 개`} />
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
function MlDialog({ shots, model, ml, sum, results, onClose }: {
  shots: Shot[]; model: ModelInfo; ml: MlModel; sum: InspectionSummary; results: SecondMap; onClose: () => void;
}) {
  const th = ml.threshold;
  const first = sum.first;
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
                <thead><tr><th>샷</th><th>시각</th><th>1차 점수</th><th>1차</th><th>2차</th><th>실제</th></tr></thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr><td colSpan={6} className={po.sub}>표시할 샷이 없습니다</td></tr>
                  ) : list.map(x => {
                    const fail = firstFail(x, th);
                    const st = secondOf(x, th, results);
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
                          {typeof st === 'object'
                            ? <span className={`${po.pill} ${st.result === 'fail' ? po.pill_bad : po.pill_ok}`}>{st.result === 'fail' ? '불량' : '양품'}</span>
                            : <span className={po.sub}>{st === 'first' ? '대상 아님' : st === 'pending' ? '판정 대기' : '이미지 없음'}</span>}
                        </td>
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
              <Stat label={`2차 불량률 (검사 ${sum.inspected}샷${sum.pending ? ` · 대기 ${sum.pending}샷` : ''})`} value={`${pct(rate(sum.second, sum.inspected))} %`} />
              <Stat label="2차 불량 개수" value={`${sum.second} 개`} />
            </div>
            {selected ? <ShotAnalysis shot={selected} model={model} th={th} results={results} /> : <div className={s.slot}>샷을 선택하세요</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

/** 선택 샷 — 1차 결과 + 2차(DL) 칸 + 주요 변수 */
function ShotAnalysis({ shot, model, th, results }: {
  shot: Shot; model: ModelInfo; th: number; results: SecondMap;
}) {
  const st = secondOf(shot, th, results);
  const imageId = st !== 'first' && st !== 'noImage' ? shot.castingId : undefined;   // 판정 대기·판정 결과 = 사진 있음
  return (
    <>
      <span className={po.sub}>
        #{shot.shotId} · {shot.time} · 1차 점수 <span className={po.num}>{shot.prob.toFixed(3)}</span> ({st === 'first' ? '불량' : '양품'})
        {' '}· 실제 {shot.actual === 1 ? '불량' : shot.actual === 0 ? '양품' : '미판정'}
      </span>
      {/* 판정 대기는 박스 없음 — 목록 2차 열·상단 「대기 N샷」으로 표시 */}
      {st !== 'pending' && (
        <div className={s.slot}>
          {st === 'first' ? `#${shot.shotId} · 1차 불량 확정 — 2차 검사 대상 아님`
            : st === 'noImage' ? '2차(DL) 검사 대상 · 샷 이미지 없음 (이미지 수집 전)'
            // slot 이 flex 라 조각 사이 공백이 사라짐 → 한 span 으로 묶음
            : <span>2차(DL) <b>{st.result === 'fail' ? '불량' : '양품'}</b> · 불량 확률 <span className={po.num}>{st.confidenceScore.toFixed(3)}</span> · {st.modelName}</span>}
        </div>
      )}
      {/* key: 샷을 바꾸면 「이미지 없음」 상태 초기화 */}
      {imageId && <ShotImage key={imageId} castingId={imageId} className={s.shotImage} />}
      <KeyVariables shot={shot} model={model} />
    </>
  );
}
