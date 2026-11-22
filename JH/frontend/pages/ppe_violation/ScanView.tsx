"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./PpeViolation.module.css";
import { ppePhotoUrl } from "./data";
import { GEAR_LABEL, type Gear, type GearStatus } from "./rules";

// 사진이 없을 때 쓰는 대체 그림 — 실루엣 + 장구별 고정 박스 (판정 결과 색)
const BOXES: Record<Gear, { x: number; y: number; w: number; h: number }> = {
  helmet: { x: 78, y: 14, w: 44, h: 22 },
  goggles: { x: 82, y: 40, w: 36, h: 12 },
  vest: { x: 68, y: 70, w: 64, h: 70 },
  gloves: { x: 34, y: 140, w: 26, h: 26 },
  shoes: { x: 70, y: 226, w: 60, h: 22 },
};

const COLOR: Record<GearStatus, string> = { worn: "#2fb36b", missing: "#e5484d", unknown: "#8b93a1" };

/**
 * 검색대 촬영 이미지 — 판정 사진(MS image_api, 모델 박스·이름이 사진에 이미 그려져 있음)을 보여 주고,
 * 사진이 없으면(404) 예전 실루엣 그림(게이트 장구별 충족·미충족·판정 불가 박스) + 범례. 사진을 누르면 크게 보기.
 * 판정이 바뀌면 부모가 key 로 다시 그림 (사진 실패 상태 초기화)
 */
export default function ScanView({ checkIdx, gears, caption, title }: {
  checkIdx: number; gears: { gear: Gear; status: GearStatus }[]; caption: string; title: string;
}) {
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  const src = ppePhotoUrl(checkIdx);

  if (failed) {
    return (
      <>
        <Silhouette gears={gears} caption={caption} />
        {/* 범례는 대체 그림의 색 박스용 (사진에는 모델이 그린 표시가 있음) */}
        <div className={styles.legend}>
          <span><i className={styles.ok} /> 충족</span>
          <span><i className={styles.bad} /> 미충족</span>
          <span><i className={styles.grey} /> 판정 불가</span>
        </div>
      </>
    );
  }

  return (
    <>
      <button type="button" className={styles.photoBtn} onClick={() => setZoom(true)} aria-label={`${title} 사진 크게 보기`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 서버 jpg 그대로 (Next 이미지 최적화 대상 아님) */}
        <img className={styles.photo} src={src} alt={`${title} 검색대 판정 사진 (${caption})`} loading="lazy"
          onError={() => setFailed(true)} />
        <span className={styles.zoomHint} aria-hidden>크게 보기</span>
      </button>
      {zoom && <PhotoDialog src={src} title={title} onClose={() => setZoom(false)} />}
    </>
  );
}

/** 사진 크게 보기 — Esc·바깥 클릭·× 로 닫음. 폰은 아래에서 올라오는 시트 */
function PhotoDialog({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.photoBackdrop} onClick={onClose}>
      <div className={styles.photoDialog} role="dialog" aria-modal="true" aria-label={`${title} 사진`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.photoDialogHead}>
          <span>{title}</span>
          <button ref={closeRef} type="button" className={styles.photoClose} aria-label="닫기" onClick={onClose}>×</button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.photoLarge} src={src} alt={`${title} 검색대 판정 사진 (크게)`} />
      </div>
    </div>
  );
}

function Silhouette({ gears, caption }: { gears: { gear: Gear; status: GearStatus }[]; caption: string }) {
  return (
    <svg className={styles.scan} viewBox="0 0 200 260" role="img" aria-label={`검색대 판정 결과 그림 (${caption})`}>
      <rect width="200" height="260" fill="#2b3039" />
      {/* 사람 실루엣 */}
      <g fill="#5d6470">
        <circle cx="100" cy="42" r="20" />
        <rect x="70" y="66" width="60" height="76" rx="8" />
        <rect x="46" y="70" width="20" height="70" rx="8" />
        <rect x="134" y="70" width="20" height="70" rx="8" />
        <rect x="74" y="140" width="22" height="86" rx="6" />
        <rect x="104" y="140" width="22" height="86" rx="6" />
      </g>
      {gears.map(({ gear, status }) => {
        const b = BOXES[gear];
        const c = COLOR[status];
        return (
          <g key={gear}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke={c} strokeWidth="2" strokeDasharray={status === "unknown" ? "4 3" : undefined} />
            <rect x={b.x} y={b.y - 11} width={GEAR_LABEL[gear].length * 9 + 6} height="11" fill={c} />
            <text x={b.x + 3} y={b.y - 2.5} fontSize="8.5" fill="#fff">
              {GEAR_LABEL[gear]}
            </text>
          </g>
        );
      })}
      <text x="8" y="252" fontSize="8" fill="#c4cad4">
        {caption}
      </text>
    </svg>
  );
}
