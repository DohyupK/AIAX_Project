// 판정 규칙 자체 점검 — 실행: node JH/frontend/pages/worker_safety/rules.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { missingGear, violationMessage } from "./rules.ts";

const ALL = ["helmet", "shoes", "vest", "gloves", "goggles"] as const;

// 게이트 A: 5종 모두 필수
assert.deepEqual(missingGear("A", [...ALL]), []);
assert.deepEqual(missingGear("A", ["helmet", "shoes", "vest", "gloves"]), ["goggles"]);
// 게이트 B: 보안경은 선택이라 없어도 통과
assert.deepEqual(missingGear("B", ["helmet", "shoes", "vest", "gloves"]), []);
assert.deepEqual(missingGear("B", ["helmet", "shoes", "vest"]), ["gloves"]);
// 안내 문구 조사
assert.equal(violationMessage(["gloves"]), "장갑을 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");
assert.equal(violationMessage(["helmet"]), "안전모를 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");
assert.equal(violationMessage(["goggles", "vest"]), "보안경, 조끼를 착용하지 않았습니다. 착용 후 다시 태깅해주세요.");

console.log("worker_safety rules: OK");
