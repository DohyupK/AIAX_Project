'use client';
import { useEffect, useMemo, useState } from 'react';
import { USE_MOCK, fetchActiveModel } from '../../common/casting/api';
import { LABELS, fmt, severity, unitOf } from '../../common/casting/analysis';
import { useShotStream } from '../../common/casting/useShotStream';
import type { ModelInfo, Shot } from '../../common/casting/types';
import SensorMonitor from '../process_optimization/SensorMonitor';
import ProbChart from './ProbChart';
import { firstFail, rate, secondFail, summarize, topDeviations, type InspectionSummary } from './inspection';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './QualityInspection.module.css';

const LINE = 'line_no1';
const DATE = USE_MOCK ? '2021-10-07' : new Date().toISOString().slice(0, 10);
const pct = (v: number | null) => (v == null ? '—' : v.toFixed(1));

/**
 * 품질 검사 대시보드 — 1차 검사(ML) 후 1차 패스 샷만 2차 검사(DL)
 * 최종 불량 = 1차 불량 + 2차 불량
 */
export default function QualityInspectionDashboard() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [mlOpen, setMlOpen] = useState(false);
  const [playing, setPlaying] = useState(true);

  // 공정 최적화와 같은 실시간 샷 스트림 (목업: 한 샷씩 재생 / 실제: 폴링)
  const { shots, error: streamError, retry, finished, restart } = useShotStream(LINE, DATE, playing);

  useEffect(() => {
    fetchActiveModel().then(setModel).catch((e: Error) => setMetaError(e.message));
  }, []);
  useEffect(() => { if (finished) setPlaying(false); }, [finished]);

  const error = streamError ?? metaError;
  const load = () => {
    setMetaError(null);
    retry();
    if (!model) fetchActiveModel().then(setModel).catch((e: Error) => setMetaError(e.message));
  };
  const togglePlay = () => {
    if (!playing && finished) restart();
    setPlaying(p => !p);
  };

  const sum = useMemo(() => (model ? summarize(shots, model.threshold) : null), [shots, model]);
  // DL 칸: 가장 최근 2차 불량 샷, 아직 없으면 가장 최근 2차 검사(1차 패스) 샷
  const latestSecond = useMemo(() => {
    if (!model) return null;
    let lastTarget: Shot | null = null;
    for (let i = shots.length - 1; i >= 0; i--) {
      const r = secondFail(shots[i], model.threshold);
      if (r) return shots[i];
      if (r === false && !lastTarget) lastTarget = shots[i];
    }
    return lastTarget;
  }, [shots, model]);
  const latest = shots[shots.length - 1];

  return (
    <div className={po.page}>
      <header className={po.head}>
        <div>
          <div className={po.crumb}>주조 공정 대시보드 › 품질 검사</div>
          <h2 className={po.title}>품질 검사 대시보드</h2>
        </div>
        <div className={po.chips}>
          <span className={po.chip}>라인 <b>{LINE}</b></span>
          <span className={po.chip}>일자 <b>{DATE}</b></span>
          {model && <span className={po.chip}>1차 임계값 <b>{model.threshold}</b></span>}
          <span className={po.chip}>
            <span className={`${po.dot} ${playing ? po.dotLive : ''}`} />
            <b>{playing ? '실시간' : finished ? '재생 종료' : '일시정지'}</b>
            {latest && <span className={po.num}>· {latest.time}</span>}
          </span>
          <button type="button" className={po.btn} onClick={togglePlay}>{playing ? '일시정지' : '재생'}</button>
        </div>
      </header>

      {USE_MOCK && (
        <div className={po.banner}>
          목업 데이터: 2021-10-07 575샷을 실시간처럼 재생 중. 1차(ML) 판정은 기존 불량 확률, 2차(DL) 판정·이미지는 실제 라벨 기반 목업입니다. 모델 연결 전 화면 확인용.
        </div>
      )}

      {error && (
        <div className={po.errorBox} role="alert">
          <span>데이터를 불러오지 못했습니다: {error}</span>
          <button type="button" className={po.btn} onClick={load}>다시 시도</button>
        </div>
      )}

      {!sum && !error && <div className={po.panel}>데이터를 불러오는 중입니다…</div>}

      {model && sum && (
        <>
          <section className={`${po.grid} ${s.kpis3}`} aria-label="품질 요약 지표">
            <Kpi label="전체 생산 샷" value={sum.total.toLocaleString()} unit="샷" />
            <Kpi label="최종 불량률" value={pct(rate(sum.final, sum.total))} unit="%" bad={sum.final > 0} />
            <Kpi label="전체 불량 개수" value={String(sum.final)} unit="개" bad={sum.final > 0} />
          </section>

          <section className={`${po.grid} ${s.models}`}>
            <button type="button" className={`${po.panel} ${s.modelCard}`} onClick={() => setMlOpen(true)}>
              <span className={s.modelHead}><b>ML 모델 · 1차 검사</b><span className={po.sub}>누르면 샷 목록</span></span>
              <ModelStats label="1차" n={sum.first} rateV={rate(sum.first, sum.total)} base={`전체 ${sum.total}샷 대상`} />
              <span className={s.cardSection}>
                <span className={po.sub}>실시간 불량 확률 · 최근 60샷 · 빨간 점선 = 판정 기준</span>
                <ProbChart shots={shots} threshold={model.threshold} />
              </span>
            </button>
            <div className={`${po.panel} ${s.modelCard}`}>
              <span className={s.modelHead}><b>DL 모델 · 2차 검사</b><span className={po.sub}>1차 양품 샷만 검사</span></span>
              <ModelStats label="2차" n={sum.second} rateV={rate(sum.second, sum.secondTargets)} base={`1차 양품 ${sum.secondTargets}샷 대상`} />
              <span className={s.cardSection}>
                <span className={po.sub}>실시간 2차 분석 · 최근 2차 불량 샷 (없으면 최근 검사 샷)</span>
                {latestSecond ? <DlAnalysis shot={latestSecond} model={model} /> : <span className={s.slot}>2차 검사 대기 중</span>}
              </span>
            </div>
          </section>

          {shots.length > 0 && <SensorMonitor shots={shots} model={model} />}

          {mlOpen && <MlDialog shots={shots} model={model} sum={sum} onClose={() => setMlOpen(false)} />}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, bad }: { label: string; value: string; unit: string; bad?: boolean }) {
  return (
    <div className={`${po.panel} ${po.kpi} ${bad ? po.kpi_bad : ''}`}>
      <span className={po.kpiLabel}>{label}</span>
      <span className={`${po.kpiValue} ${po.num}`}>{value}<small>{unit}</small></span>
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

/** ML 팝업 — 좌: 1차 검사 샷 목록 / 우: 선택 샷의 2차(DL) 분석 */
function MlDialog({ shots, model, sum, onClose }: {
  shots: Shot[]; model: ModelInfo; sum: InspectionSummary; onClose: () => void;
}) {
  const th = model.threshold;
  const [filter, setFilter] = useState<'all' | 'defect'>('all');
  const list = useMemo(() => (filter === 'all' ? shots : shots.filter(x => firstFail(x, th))), [shots, filter, th]);
  const [selectedId, setSelectedId] = useState<number | null>(() => shots.find(x => !firstFail(x, th))?.shotId ?? null);
  const selected = shots.find(x => x.shotId === selectedId) ?? null;

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
              <Stat label="1차 불량률" value={`${pct(rate(sum.first, sum.total))} %`} />
              <Stat label="1차 불량 개수" value={`${sum.first} 개`} />
            </div>
            <div className={s.toolbar}>
              <span className={po.sub}>샷 목록 · {list.length}건</span>
              <select className={po.btn} value={filter} aria-label="필터"
                onChange={e => setFilter(e.target.value as 'all' | 'defect')}>
                <option value="all">전체</option>
                <option value="defect">불량</option>
              </select>
            </div>
            <div className={s.list}>
              <table className={s.table}>
                <thead><tr><th>샷</th><th>시각</th><th>불량 확률</th><th>1차 판정</th></tr></thead>
                <tbody>
                  {list.map(x => {
                    const fail = firstFail(x, th);
                    return (
                      <tr key={x.shotId} className={x.shotId === selectedId ? s.rowSelected : ''}
                        onClick={() => setSelectedId(x.shotId)}>
                        <td>
                          <button type="button" className={s.rowBtn} aria-pressed={x.shotId === selectedId}
                            onClick={() => setSelectedId(x.shotId)}>#{x.shotId}</button>
                        </td>
                        <td className={po.num}>{x.time}</td>
                        <td className={po.num}>{(x.prob * 100).toFixed(1)}%</td>
                        <td><span className={`${po.pill} ${fail ? po.pill_bad : po.pill_ok}`}>{fail ? '불량' : '정상'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={s.col}>
            <div className={s.stats}>
              <Stat label="2차 불량률" value={`${pct(rate(sum.second, sum.secondTargets))} %`} />
              <Stat label="2차 불량 개수" value={`${sum.second} 개`} />
            </div>
            {selected ? <DlAnalysis shot={selected} model={model} /> : <div className={s.slot}>샷을 선택하세요</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

/** 선택 샷의 2차(DL) 분석 — 이미지 + 주요 변수 */
function DlAnalysis({ shot, model }: { shot: Shot; model: ModelInfo }) {
  const result = secondFail(shot, model.threshold);
  if (result === null) {
    return <div className={s.slot}>#{shot.shotId} · 1차 불량 확정 — 2차 검사 대상 아님</div>;
  }
  const top = topDeviations(shot, model);
  const STATUS = { ok: '정상', warn: '주의', bad: '이탈', na: '결측' } as const;

  return (
    <div className={s.analysis}>
      <figure className={s.figure}>
        <MockImage shotId={shot.shotId} defect={result} />
        <figcaption className={s.caption}>
          #{shot.shotId} · {shot.time} ·{' '}
          <span className={`${po.pill} ${result ? po.pill_bad : po.pill_ok}`}>2차 {result ? '불량' : '양품'}</span>
        </figcaption>
      </figure>
      <div>
        <div className={po.sub}>주요 변수 (정상 범위 대비 벗어난 순)</div>
        <ul className={s.vars}>
          {top.map(t => {
            const [lo, , hi] = model.bands[t.key];
            const sev = severity(model, t.key, t.value);
            return (
              <li key={t.key} className={s.varRow}>
                <span className={s.varTop}>
                  <span>{LABELS[t.key]}</span>
                  <span className={`${po.pill} ${po[`pill_${sev}`]}`}>{STATUS[sev]}</span>
                </span>
                <b className={po.num}>{fmt(t.value)} {unitOf(t.key)}</b>
                <span className={`${po.sub} ${po.num}`}>정상 {fmt(lo)} – {fmt(hi)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** ponytail: 실제 비전 이미지 없음 — 주물 윤곽 SVG 목업. 결함 위치는 shotId 로 고정 생성. DL 연결 시 <img> 로 교체 */
function MockImage({ shotId, defect }: { shotId: number; defect: boolean }) {
  const x = 60 + ((shotId * 37) % 180);
  const y = 50 + ((shotId * 53) % 100);
  return (
    <svg viewBox="0 0 320 220" className={s.image} role="img" aria-label={defect ? '결함 표시된 목업 이미지' : '목업 이미지'}>
      <rect width="320" height="220" fill="#2b2f36" />
      <rect x="30" y="30" width="260" height="160" rx="18" fill="#6b717c" />
      {[80, 140, 200, 260].map(cx => <circle key={cx} cx={cx - 10} cy="110" r="22" fill="#4b5059" />)}
      <rect x="40" y="40" width="240" height="14" rx="4" fill="#80868f" />
      {defect && (
        <g>
          <rect x={x} y={y} width="44" height="34" fill="none" stroke="#ff4d4d" strokeWidth="2.5" />
          <text x={x} y={y - 5} style={{ fill: '#ff4d4d', fontSize: 11 }}>defect</text>
        </g>
      )}
    </svg>
  );
}
