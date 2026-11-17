'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LABELS, fmt, severity, unitOf } from '../../common/casting/analysis';
import type { FeatureKey, ModelInfo, Shot } from '../../common/casting/types';
import { PHASES, createDiecastScene, type SceneShot } from './sceneRenderer';
import po from './ProcessOptimization.module.css';
import s from './DiecastScene.module.css';

// 품질 검사 페이지 주소 (루트 app/casting/quality-inspection, page_registry 등록)
const QUALITY_PATH = '/casting/quality-inspection';
const FAST = 20;

/**
 * 다이캐스팅 설비 장면 — 한 바퀴 = 평균 설비 사이클 ÷ 배속, 바퀴마다 가장 최근 샷 값을 센서 라벨에 표시
 * 라벨 클릭 → onPick(변수), 단계 바뀔 때 → onPhase(단계 묶음 0·1·2)
 */
export default function DiecastScene({ shots, model, playing, cycleSec, speed, onSpeed, onPick, onPhase }: {
  shots: Shot[]; model: ModelInfo; playing: boolean;
  /** 평균 설비 사이클(초, 1배속 기준) */ cycleSec: number;
  speed: number; onSpeed: (x: number) => void;
  onPick: (k: FeatureKey) => void; onPhase?: (group: number) => void;
}) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<ReturnType<typeof createDiecastScene> | null>(null);
  // 장면은 한 번만 만들고, 최신 값은 ref 로 읽음 (매 렌더마다 다시 그리지 않게)
  const live = useRef({ shots, model, onPick, onPhase, cycle: cycleSec / speed });
  live.current = { shots, model, onPick, onPhase, cycle: cycleSec / speed };
  const [ph, setPh] = useState<{ i: number; time: string | null }>({ i: 0, time: null });

  useEffect(() => {
    if (!svgRef.current) return;
    const scene = createDiecastScene(svgRef.current, {
      cls: s,
      getShot: () => live.current.shots[live.current.shots.length - 1] ?? null,
      cycleSec: () => live.current.cycle,
      statusOf: (k, v) => severity(live.current.model, k, v),
      mid: k => live.current.model.bands[k]?.[1] ?? null,
      label: k => LABELS[k],
      unit: unitOf,
      format: fmt,
      onPick: k => live.current.onPick(k),
      onQuality: () => router.push(QUALITY_PATH),
      onPhase: (i, shot: SceneShot | null) => {
        setPh({ i, time: shot?.time ?? null });
        live.current.onPhase?.(PHASES[i].group);
      },
    });
    sceneRef.current = scene;
    return () => { scene.destroy(); sceneRef.current = null; };
  }, []);

  useEffect(() => { sceneRef.current?.setPaused(!playing); }, [playing]);

  const p = PHASES[ph.i];
  return (
    <div className={`${po.panel} ${s.scene}`}>
      <div className={s.speed}>
        <span className={s.speedInfo}>1 사이클 {Math.round(cycleSec)}초{speed > 1 && ` → ${(cycleSec / speed).toFixed(1)}초`}</span>
        <button type="button" className={`${po.btn} ${speed > 1 ? s.speedOn : ''}`} aria-pressed={speed > 1}
          title="설비 장면과 데이터 재생을 20배속으로" onClick={() => onSpeed(speed > 1 ? 1 : FAST)}>×{FAST}</button>
      </div>
      <svg ref={svgRef} className={s.svg} viewBox="0 0 1200 770" preserveAspectRatio="xMidYMid meet"
        role="group" aria-label="다이캐스팅 설비 장면 — 센서 라벨을 누르면 공정 변수 모니터로 이동" />
      <div className={s.banner} aria-live="off">
        <span className={s.bannerK}>PHASE {ph.i + 1}/{PHASES.length}{ph.time && ` · ${ph.time}`}</span>
        <span className={s.bannerV}>{p.n}</span>
        <span className={s.bannerE}>{p.e}</span>
      </div>
      <div className={s.legend}>
        <span><i style={{ background: 'var(--ok)' }} />정상</span>
        <span><i style={{ background: 'var(--warn)' }} />주의</span>
        <span><i style={{ background: 'var(--bad)' }} />이탈</span>
        <span><i style={{ background: '#f4431c' }} />용탕</span>
      </div>
    </div>
  );
}
