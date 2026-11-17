// 게이트별 안전장구 판정 규칙 — 화면·백엔드가 같은 기준을 쓰도록 순수 함수로 분리 (import 없음)

export type Gear = "helmet" | "shoes" | "vest" | "gloves" | "goggles";
export type Gate = "A" | "B";

export const GEAR_LABEL: Record<Gear, string> = {
  helmet: "안전모",
  shoes: "안전화",
  vest: "조끼",
  gloves: "장갑",
  goggles: "보안경",
};

/** A = 다이캐스팅 설비 인원, B = 품질 검사 인원 */
export const GATE_RULES: Record<Gate, { required: Gear[]; optional: Gear[] }> = {
  A: { required: ["helmet", "shoes", "vest", "gloves", "goggles"], optional: [] },
  B: { required: ["helmet", "shoes", "vest", "gloves"], optional: ["goggles"] },
};

export type GearStatus = "worn" | "missing" | "optional_missing";

/** 장구별 상태: 착용 / 필수 미착용(위반) / 선택 미착용 */
export function gearStatus(gate: Gate, detected: Gear[]): { gear: Gear; status: GearStatus }[] {
  const { required, optional } = GATE_RULES[gate];
  return [...required, ...optional].map((gear) => ({
    gear,
    status: detected.includes(gear) ? "worn" : required.includes(gear) ? "missing" : "optional_missing",
  }));
}

/** 필수 장구 중 검출되지 않은 항목. 비어 있으면 통과(개찰구 개방) */
export function missingGear(gate: Gate, detected: Gear[]): Gear[] {
  return GATE_RULES[gate].required.filter((g) => !detected.includes(g));
}

/** 마지막 글자 받침 유무로 을/를 선택 */
function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "을(를)";
  return code % 28 ? "을" : "를";
}

/** 검색대 음성 안내 문구 (예: '장갑을 착용하지 않았습니다. 착용 후 다시 태깅해주세요.') */
export function violationMessage(missing: Gear[]): string {
  const words = missing.map((g) => GEAR_LABEL[g]).join(", ");
  return `${words}${objectParticle(words)} 착용하지 않았습니다. 착용 후 다시 태깅해주세요.`;
}
