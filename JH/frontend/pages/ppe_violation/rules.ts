// 게이트별 안전장구 판정 규칙 — 화면·백엔드가 같은 기준을 쓰도록 순수 함수로 분리 (import 없음)

export type Gear = "helmet" | "shoes" | "vest" | "gloves" | "goggles";
export type Gate = "a" | "b";

export const GEAR_LABEL: Record<Gear, string> = {
  helmet: "안전모",
  shoes: "안전화",
  vest: "조끼",
  gloves: "장갑",
  goggles: "보안경",
};

/**
 * a·b = 회사 정문 (DB 게이트 코드 그대로). DB ai.ppe_gate_rule 과 같은 기준 — 규칙이 바뀌면 둘 다 고침.
 * 게이트에서 검사·표시하는 장구 = 필수 장구만 (b 는 보안경 제외 4종, DB goggles=false)
 */
export const GATE_RULES: Record<Gate, Gear[]> = {
  a: ["helmet", "shoes", "vest", "gloves", "goggles"],
  b: ["helmet", "shoes", "vest", "gloves"],
};

export type GearStatus = "worn" | "missing" | "unknown";

/** 게이트 장구별 상태: 착용 / 미착용(위반) / 판정 불가(카메라가 못 봄) */
export function gearStatus(gate: Gate, detected: Gear[], unknown: Gear[] = []): { gear: Gear; status: GearStatus }[] {
  return GATE_RULES[gate].map((gear) => ({
    gear,
    status: unknown.includes(gear) ? "unknown" : detected.includes(gear) ? "worn" : "missing",
  }));
}

/** 필수 장구 중 검출되지 않은 항목. 비어 있으면 통과(개찰구 개방) */
export function missingGear(gate: Gate, detected: Gear[]): Gear[] {
  return GATE_RULES[gate].filter((g) => !detected.includes(g));
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
