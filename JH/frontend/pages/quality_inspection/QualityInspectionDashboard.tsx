'use client';
import { useEffect, useMemo, useState } from 'react';
import { LINES, fetchActiveModel, fetchDates, type Line } from '../../common/casting/api';
import { useShotStream } from '../../common/casting/useShotStream';
import type { ModelInfo } from '../../common/casting/types';
import SensorMonitor from '../process_optimization/SensorMonitor';
import KeyVariables from './KeyVariables';
import { rate } from './inspection';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './QualityInspection.module.css';

const pct = (v: number | null) => (v == null ? '—' : v.toFixed(1));

/**
 * 품질 검사 대시보드 — 실데이터(mes.investment_casting, JH API)로 바로 보여줄 수 있는 항목만
 * 판정 = 실제 판정(passorfail). 정상 범위는 목업 model.json (공정 변수 모니터와 같은 기준)
 * ponytail: 1차(ML 확률)·2차(DL 이미지) 검사는 모델 연결 후 다시 붙임 — inspection.ts firstFail/secondFail, ProbChart.tsx 보관
 */
export default function QualityInspectionDashboard() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [line, setLine] = useState<Line>('line_no1'); // 라인 선택 (「전체」 없음)
  const [dates, setDates] = useState<string[] | null>(null); // null = 조회 전
  const [date, setDate] = useState(''); // 기본: 데이터가 있는 가장 최근 날짜
  const [filter, setFilter] = useState<'all' | 'defect'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 공정 최적화와 같은 실데이터 스트림 — 고른 날짜를 처음부터 재생
  const { shots, loading, error: streamError, retry, finished, restart } = useShotStream(line, date, playing, true);

  useEffect(() => {
    fetchActiveModel().then(setModel).catch((e: Error) => setMetaError(e.message));
  }, []);
  useEffect(() => {
    let alive = true;
    setDates(null);
    fetchDates(line)
      .then(ds => { if (alive) { setDates(ds); setDate(d => (ds.includes(d) ? d : ds[0] ?? '')); } })
      .catch((e: Error) => { if (alive) setMetaError(e.message); });
    return () => { alive = false; };
  }, [line]);
  useEffect(() => { if (finished) setPlaying(false); }, [finished]);
  useEffect(() => { setSelectedId(null); }, [line, date]);

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

  const defects = useMemo(() => shots.filter(x => x.actual === 1).length, [shots]);
  // 최근 샷이 위로
  const list = useMemo(() => (filter === 'all' ? shots : shots.filter(x => x.actual === 1)).slice().reverse(), [shots, filter]);
  const latest = shots[shots.length - 1];
  // 선택 전에는 가장 최근 샷의 주요 변수
  const selected = shots.find(x => x.shotId === selectedId) ?? latest ?? null;

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
          <span className={po.chip}>
            <span className={`${po.dot} ${playing ? po.dotLive : ''}`} />
            <b>{playing ? '실시간' : finished ? '재생 종료' : '일시정지'}</b>
            {latest && <span className={po.num}>· {latest.time}</span>}
          </span>
          <button type="button" className={po.btn} onClick={togglePlay}>{playing ? '일시정지' : '재생'}</button>
        </div>
      </header>

      <div className={po.banner}>
        실데이터(공정 DB): 고른 날짜의 샷을 처음부터 재생합니다. 불량은 실제 판정 결과 기준이며, 1차(ML)·2차(DL) 검사는 모델 연결 후 표시됩니다.
      </div>

      {error && (
        <div className={po.errorBox} role="alert">
          <span>데이터를 불러오지 못했습니다: {error}</span>
          <button type="button" className={po.btn} onClick={load}>다시 시도</button>
        </div>
      )}

      {loading && dates?.length !== 0 && !shots.length && !error && <div className={po.panel}>데이터를 불러오는 중입니다…</div>}
      {(dates?.length === 0 || (!loading && date && !shots.length)) && !error && (
        <div className={`${po.panel} ${po.emptyLine}`} role="status">
          <b>{line}</b> 데이터가 아직 연결되지 않았습니다.
          <span className={po.sub}>라인 설비 데이터가 연결되면 검사 결과와 공정 변수가 표시됩니다.</span>
        </div>
      )}

      {model && shots.length > 0 && (
        <>
          <section className={`${po.grid} ${s.kpis3}`} aria-label="품질 요약 지표">
            <Kpi label="전체 생산 샷" value={shots.length.toLocaleString()} unit="샷" />
            <Kpi label="불량률" value={pct(rate(defects, shots.length))} unit="%" bad={defects > 0} />
            <Kpi label="불량 개수" value={String(defects)} unit="개" bad={defects > 0} />
          </section>

          <section className={po.panel}>
            <div className={po.panelHead}>
              <h3>샷 판정 목록</h3>
              <span className={po.sub}>실제 판정 · 샷을 누르면 오른쪽에 주요 변수</span>
            </div>
            <div className={s.split}>
              <div className={s.col}>
                <div className={s.toolbar}>
                  <span className={po.sub}>최근 순 · {list.length}건</span>
                  <select className={po.btn} value={filter} aria-label="필터"
                    onChange={e => setFilter(e.target.value as 'all' | 'defect')}>
                    <option value="all">전체</option>
                    <option value="defect">불량</option>
                  </select>
                </div>
                <div className={s.list}>
                  <table className={s.table}>
                    <thead><tr><th>샷</th><th>시각</th><th>판정</th></tr></thead>
                    <tbody>
                      {list.map(x => (
                        <tr key={x.shotId} className={x.shotId === selected?.shotId ? s.rowSelected : ''}
                          onClick={() => setSelectedId(x.shotId)}>
                          <td>
                            <button type="button" className={s.rowBtn} aria-pressed={x.shotId === selected?.shotId}
                              onClick={() => setSelectedId(x.shotId)}>#{x.shotId}</button>
                          </td>
                          <td className={po.num}>{x.time}</td>
                          <td>
                            {x.actual == null
                              ? <span className={po.sub}>미판정</span>
                              : <span className={`${po.pill} ${x.actual ? po.pill_bad : po.pill_ok}`}>{x.actual ? '불량' : '양품'}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className={s.col}>
                {selected && (
                  <>
                    <span className={po.sub}>
                      #{selected.shotId} · {selected.time} · {selected.actual === 1 ? '불량' : selected.actual === 0 ? '양품' : '미판정'}
                      {selectedId == null && ' (가장 최근 샷)'}
                    </span>
                    <KeyVariables shot={selected} model={model} />
                  </>
                )}
              </div>
            </div>
          </section>

          <SensorMonitor shots={shots} model={model} />
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
