import { GEAR_LABEL } from '../worker_safety/rules';
import { DEFECT_LABEL, FIXED, RECYCLE_VALUE, UNIT_PRICE, type PeriodReport } from './data';
import { compareReport, computeReport } from './logic';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './ManagementReport.module.css';

export const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const won = (n: number) => `${n.toLocaleString()}원`;
const n0 = (n: number) => n.toLocaleString();

type Tone = 'ok' | 'warn' | 'bad';

/**
 * 경영 리포트 본문 — 요약 띠 + S 안전 / Q 품질 / D 생산·설비 / C 원가 / P 인력
 * prev = 직전 기간 리포트 (전일·전주·전월 대비 증감용)
 */
export default function ReportView({ r, prev, prevLabel, cumulative }: {
  r: PeriodReport; prev: PeriodReport | null; prevLabel: string; cumulative: boolean;
}) {
  const c = computeReport(r, UNIT_PRICE, RECYCLE_VALUE);
  const d = compareReport(r, prev);
  const maxType = c.defectTypes[0]?.[1] ?? 1;

  return (
    <>
      {/* 요약 띠 — 영역별 핵심 1개 */}
      <div className={s.strip}>
        <Summary k="S 안전" v={`위반 ${r.safety.violations}건`} tone={r.safety.violations ? 'warn' : 'ok'} />
        <Summary k="Q 품질" v={`불량률 ${pct(c.defectRate)}`} tone={(c.defectRate ?? 0) > 0.03 ? 'warn' : 'ok'} />
        <Summary k="D 생산" v={`생산 ${n0(r.production)}개`} tone="ok" />
        <Summary k="C 원가" v={`순손실 ${pct(c.netLossRate)}`} tone={(c.netLossRate ?? 0) > 0.03 ? 'warn' : 'ok'} />
        <Summary k="P 인력" v={`출근 ${pct(c.attendanceRate)}`} tone={(c.attendanceRate ?? 1) < 0.95 ? 'warn' : 'ok'} />
      </div>

      <Section badge="S" title="안전 (검색대 안전장구)" note="작업자 안전 관리 대시보드 집계">
        <div className={s.cards}>
          <Card label="검색대 통과율" value={pct(c.safetyPassRate)} sub={`태깅 ${n0(r.safety.scans)}건`} tone={(c.safetyPassRate ?? 1) < 0.98 ? 'warn' : 'ok'} />
          <Card label="미착용 위반" value={n0(r.safety.violations)} unit="건" tone={r.safety.violations ? 'bad' : 'ok'}
            sub={<>{prevLabel} <Delta v={d.violations} fmt={x => String(Math.abs(x))} /></>} />
          <Card label="재위반 인원" value={n0(r.safety.repeatViolators)} unit="명" sub="기간 내 2회 이상 위반" tone={r.safety.repeatViolators ? 'bad' : 'ok'} />
        </div>
        <div className={s.safetyGrid}>
          <div>
            <div className={po.sub}>업체별 위반 (많은 순)</div>
            <table className={s.table}>
              <thead><tr><th>업체</th><th>구분</th><th>위반</th></tr></thead>
              <tbody>
                {c.companies.map(x => (
                  <tr key={x.company}><td>{x.company}</td><td>{x.type}</td><td className={po.num}>{x.count}건</td></tr>
                ))}
                {!c.companies.length && <tr><td colSpan={3}>위반 없음</td></tr>}
              </tbody>
            </table>
          </div>
          <div>
            <div className={po.sub}>미착용 장구 (많은 순)</div>
            <ul className={s.bars}>
              {c.gears.map(([g, cnt]) => (
                <li key={g}>
                  <span>{GEAR_LABEL[g]}</span>
                  <span className={s.bar}><span style={{ width: `${(cnt / c.gears[0][1]) * 100}%` }} /></span>
                  <b className={po.num}>{cnt}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section badge="Q" title="품질" note="품질 검사(ML·DL) · 공정 SPC 집계">
        <div className={`${s.cards} ${s.cards3}`}>
          <Card label="불량량" value={n0(r.defects)} unit="개" tone="bad"
            sub={<>불량률 {pct(c.defectRate)} · {prevLabel} <Delta v={d.defectRatePp} fmt={x => `${Math.abs(x).toFixed(1)}%p`} /></>} />
          <Card label="SPC 경고 알람" value={n0(c.spcTotal)} unit="회" sub={`UCL 초과 ${r.spcAlarms.ucl} · LCL 미만 ${r.spcAlarms.lcl}`} tone={c.spcTotal ? 'warn' : 'ok'} />
          <Card label="고객사 리콜" value={n0(FIXED.recallCount)} unit="회" sub="최근 12개월 (고정 값)" tone={FIXED.recallCount ? 'bad' : 'ok'} />
        </div>
        <div className={s.qRow}>
          <Card label="1차 불량 재활용" value={n0(r.recycled)} unit={`/ ${n0(r.firstDefects)}개`}
            sub={`재활용률 ${pct(c.recycleRate)} · 회수 ${won(c.recycleSaving)}`} tone="ok" />
          <div className={`${po.kpi} ${s.card}`}>
            <span className={po.kpiLabel}>불량 유형 (많은 순 · 2차 검사 DL 분류)</span>
            <ul className={s.types}>
              {c.defectTypes.map(([t, n]) => (
                <li key={t}>
                  <span>{DEFECT_LABEL[t]} <b className={po.num}>{n}</b></span>
                  <span className={s.typeBar} style={{ width: `${(n / maxType) * 100}%` }} />
                </li>
              ))}
              {!c.defectTypes.length && <li>불량 없음</li>}
            </ul>
          </div>
        </div>
      </Section>

      <Section badge="D" title="생산 · 설비">
        <div className={`${s.cards} ${s.cards3}`}>
          <Card label="생산량" value={n0(r.production)} unit="개" />
          <Card label="MTTR · MTBF" value={`${FIXED.mttrHours}h · ${FIXED.mtbfHours}h`} sub="평균 수리 · 평균 고장 간격 (고정 값)" />
        </div>
      </Section>

      <Section badge="C" title="원가" note={`단가 ${won(UNIT_PRICE)} 기준`}>
        <div className={`${s.cards} ${s.cards3}`}>
          <Card label="생산 금액" value={won(c.amount)} sub="생산량 × 단가" />
          <Card label="불량 손실 비용" value={won(c.lossCost)} sub={`불량량 × 단가 · 생산 금액의 ${pct(c.defectRate)}`} tone="bad" />
          <Card label="순 손실 비용" value={won(c.netLoss)} sub={`손실 − 재활용 회수 · ${pct(c.netLossRate)}`} tone="ok" />
        </div>
      </Section>

      <Section badge="P" title={cumulative ? '인력 (근태 · 기간 누적 연인원)' : '인력 (근태)'}>
        <div className={s.cards}>
          <Card label="총 인원" value={n0(r.attendance.total)} unit="명" />
          <Card label="출근 인원" value={n0(r.attendance.present)} unit="명" />
          <Card label="출근율" value={pct(c.attendanceRate)} tone={(c.attendanceRate ?? 1) < 0.95 ? 'warn' : 'ok'} />
          <Card label="인당 생산" value={c.perCapita == null ? '—' : c.perCapita.toFixed(1)} unit="개" sub="생산량 ÷ 출근 인원" />
        </div>
      </Section>
    </>
  );
}

function Section({ badge, title, note, children }: { badge: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className={`${po.panel} ${s.block}`}>
      <div className={po.panelHead}>
        <h3 className={s.secTitle}><span className={s.secBadge}>{badge}</span>{title}</h3>
        {note && <span className={po.sub}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Summary({ k, v, tone }: { k: string; v: string; tone: Tone }) {
  return (
    <div className={`${s.sum} ${s[`sum_${tone}`]}`}>
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

/** 증감 표시 — 증가 ▲(빨강: 위반·불량은 늘면 나쁨) / 감소 ▼(초록) / 동일 – */
function Delta({ v, fmt }: { v: number | null; fmt: (x: number) => string }) {
  if (v == null) return <span className={s.flat}>비교 없음</span>;
  if (Math.abs(v) < 1e-9) return <span className={s.flat}>– 0</span>;
  return v > 0 ? <span className={s.up}>▲{fmt(v)}</span> : <span className={s.down}>▼{fmt(v)}</span>;
}

function Card({ label, value, unit, sub, tone }: {
  label: string; value: string; unit?: string; sub?: React.ReactNode; tone?: Tone;
}) {
  return (
    <div className={`${po.kpi} ${s.card} ${tone ? po[`kpi_${tone}`] : ''}`}>
      <span className={po.kpiLabel}>{label}</span>
      <span className={`${s.value} ${po.num}`}>{value}{unit && <small>{unit}</small>}</span>
      {sub && <span className={po.sub}>{sub}</span>}
    </div>
  );
}
