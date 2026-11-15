import { LABELS, fmt, severity, unitOf } from '../../common/casting/analysis';
import type { ModelInfo, Shot } from '../../common/casting/types';
import { topDeviations } from './inspection';
import po from '../process_optimization/ProcessOptimization.module.css';
import s from './QualityInspection.module.css';

const STATUS = { ok: '정상', warn: '주의', bad: '이탈', na: '결측' } as const;

/** 샷의 주요 변수 5개 (정상 범위 대비 벗어난 순, 2열 2-2-1) — 품질 검사 2차 분석·불량 유형 라벨링 공용 */
export default function KeyVariables({ shot, model }: { shot: Shot; model: ModelInfo }) {
  return (
    <div>
      <div className={po.sub}>주요 변수 (정상 범위 대비 벗어난 순)</div>
      <ul className={s.vars}>
        {topDeviations(shot, model).map(t => {
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
  );
}
