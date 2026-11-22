/** 답변 표시용 — 마크다운 강조 기호 제거 (원문·sessionStorage는 그대로) */
export function plainText(raw: string): string {
  let t = raw ?? "";
  // 코드 펜스
  t = t.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/^```\w*\n?/, "").replace(/```$/, "").trim(),
  );
  // 인라인 코드
  t = t.replace(/`([^`]+)`/g, "$1");
  // 링크 [텍스트](url)
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // 볼드 먼저, 그다음 이탤릭
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/\*([^*\n]+)\*/g, "$1");
  t = t.replace(/_([^_\n]+)_/g, "$1");
  // 제목 #
  t = t.replace(/^#{1,6}\s+/gm, "");
  // 남은 단독 ** __
  t = t.replace(/\*\*/g, "").replace(/__/g, "");
  return t;
}