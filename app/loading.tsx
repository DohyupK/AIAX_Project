/** 라우트 전환 시 즉시 보이는 스켈레톤 — 빈 본문·문구만 대기 체감 완화 */
export default function Loading() {
  const bone = {
    background: "#e8e8e8",
    borderRadius: 8,
  } as const;
  return (
    <div
      style={{
        padding: "1.5rem 1.25rem",
        color: "#555",
        fontSize: "0.9rem",
      }}
      role="status"
      aria-live="polite"
      aria-label="페이지를 불러오는 중"
    >
      <div style={{ ...bone, height: 12, width: 160, marginBottom: 10, borderRadius: 4 }} />
      <div style={{ ...bone, height: 26, width: 260, marginBottom: 18, borderRadius: 4 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ ...bone, minHeight: 200 }} />
        <div style={{ ...bone, minHeight: 200 }} />
      </div>
      <div style={{ ...bone, height: 120, width: "100%" }} />
      <p style={{ marginTop: 14, marginBottom: 0 }}>페이지를 불러오는 중…</p>
    </div>
  );
}
