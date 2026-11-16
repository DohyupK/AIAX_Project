/** 라우트 전환 시 즉시 보이는 로딩 UI — 빈 셸 대기 체감 완화 */
export default function Loading() {
  return (
    <div
      style={{
        padding: "2rem 1.5rem",
        color: "#333",
        fontSize: "0.95rem",
      }}
      role="status"
      aria-live="polite"
    >
      페이지를 불러오는 중…
    </div>
  );
}
