// 정렬·입력 검사 자체 점검 — 실행: node JH/frontend/pages/model_management/logic.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { MODELS, PROCESS } from "./data.ts";
import { createdAtNow, sortModels, validateDraft, type Draft } from "./logic.ts";

// 배포 모델은 어떤 정렬에서도 맨 위
for (const asc of [true, false]) {
  const out = sortModels(MODELS, "createdAt", asc, PROCESS);
  const firstUndeployed = out.findIndex((m) => !m.deployed);
  assert.ok(out.slice(firstUndeployed).every((m) => !m.deployed), "배포 모델 상단 고정");
  assert.equal(out.length, MODELS.length);
}
// 버전은 숫자 기준 정렬 (v1.10 > v1.2)
const v = sortModels(
  [
    { ...MODELS[0], id: 1, version: "v1.10", deployed: false },
    { ...MODELS[0], id: 2, version: "v1.2", deployed: false },
  ],
  "version",
  true,
  PROCESS,
);
assert.deepEqual(v.map((m) => m.version), ["v1.2", "v1.10"]);

const ok: Draft = { name: "m", version: "v1", process: "quality", description: "", accuracy: "0.9", recall: "1", precision: "0", f1: "0.5" };
assert.deepEqual(validateDraft(ok, PROCESS), {});
const bad = validateDraft({ ...ok, name: " ", process: "toString", accuracy: "1.2", recall: "", f1: "abc" }, PROCESS);
assert.deepEqual(Object.keys(bad).sort(), ["accuracy", "f1", "name", "process", "recall"]);

// 모델 종류: 영문 소문자·숫자·-·_ 만 (앞부분 하이픈·대문자·공백 거부)
assert.deepEqual(validateDraft({ ...ok, name: "lgbm_v2" }, PROCESS), {});
for (const name of ["XGB", "-xgb", "x gb", "casting/defect"]) assert.ok(validateDraft({ ...ok, name }, PROCESS).name, name);

// 생성일 자동 기록: 로컬 날짜 YYYY-MM-DD
assert.equal(createdAtNow(new Date(2026, 0, 5, 23, 59)), "2026-01-05");

console.log("model_management logic: OK");
