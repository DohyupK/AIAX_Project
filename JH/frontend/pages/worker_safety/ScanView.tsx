import styles from "./WorkerSafety.module.css";
import { GEAR_LABEL, type Gear, type GearStatus } from "./rules";

// 촬영 이미지 자리 — DL 연동 전 실루엣 + 장구별 고정 박스. 연동 시 <image> + 모델 bbox 좌표로 교체
const BOXES: Record<Gear, { x: number; y: number; w: number; h: number }> = {
  helmet: { x: 78, y: 14, w: 44, h: 22 },
  goggles: { x: 82, y: 40, w: 36, h: 12 },
  vest: { x: 68, y: 70, w: 64, h: 70 },
  gloves: { x: 34, y: 140, w: 26, h: 26 },
  shoes: { x: 70, y: 226, w: 60, h: 22 },
};

const COLOR: Record<GearStatus, string> = { worn: "#2fb36b", missing: "#e5484d", optional_missing: "#8b93a1" };

export default function ScanView({ gears, caption }: { gears: { gear: Gear; status: GearStatus }[]; caption: string }) {
  return (
    <svg className={styles.scan} viewBox="0 0 200 260" role="img" aria-label={`검색대 촬영 이미지 (${caption})`}>
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
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke={c} strokeWidth="2" strokeDasharray={status === "optional_missing" ? "4 3" : undefined} />
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
