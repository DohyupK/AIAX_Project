/**
 * 샷 촬영 이미지 자리 — 품질 검사(2차 DL)·불량 유형 라벨링 공용
 * ponytail: 실제 비전 이미지 없음 — 주물 윤곽 SVG 목업. 결함 위치는 shotId 로 고정 생성. DL 이미지 연결 시 <img src> 로 교체
 */
export default function MockShotImage({ shotId, defect, className }: { shotId: number; defect: boolean; className?: string }) {
  const x = 60 + ((shotId * 37) % 180);
  const y = 50 + ((shotId * 53) % 100);
  return (
    <svg viewBox="0 0 320 220" className={className} role="img" aria-label={`#${shotId} ${defect ? '결함 표시된 ' : ''}목업 이미지`}>
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
