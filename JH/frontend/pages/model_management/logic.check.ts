// 정렬·입력 검사 자체 점검 — 실행: node JH/frontend/pages/model_management/logic.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { MODELS, PROCESS } from "./data.ts";
import { applyDeploy, buildModelName, createdAtNow, sortModels, syncDeployedFlags, validateDraft, type Draft } from "./logic.ts";

// 배포 모델은 어떤 정렬에서도 맨 위
for (const asc of [true, false]) {
  const out = sortModels(MODELS, "createdAt", asc, PROCESS);
  const firstUndeployed = out.findIndex((m) => !m.deployed);
  assert.ok(out.slice(firstUndeployed).every((m) => !m.deployed), "배포 모델 상단 고정");
  assert.equal(out.length, MODELS.length);
}
assert.equal(MODELS.length, 56, "DieCasting 모델 56건");
assert.equal(MODELS.filter((m) => m.deployed).length, 1, "배포 모델 1건");
assert.ok(MODELS.every((m) => !m.version.includes("exp") && m.version !== "v1.0" && m.version !== "v1.0-val"), "exp/v1.0 버전 제거");
assert.ok(MODELS.every((m) => /^DieCasting_[A-Za-z0-9]+$/.test(m.name)), "표시명 DieCasting_{Algo}");
assert.ok(MODELS.every((m) => /^\d+(\.\d+)?$/.test(m.version)), "버전 숫자 형식");
// 동일 표시명에 버전이 겹치지 않음
{
  const keys = MODELS.map((m) => `${m.name}@${m.version}`);
  assert.equal(new Set(keys).size, keys.length, "name+version 유니크");
}
assert.ok(MODELS.some((m) => m.name === "DieCasting_XGB" && m.version === "1"), "XGB 시작 버전 1");
assert.ok(MODELS.some((m) => m.name === "DieCasting_XGB" && m.version === "1.01"), "XGB 소폭 1.01");
assert.ok(MODELS.some((m) => m.name === "DieCasting_XGB" && m.version === "1.1"), "XGB 큰 차이 1.1");

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

const ok: Draft = { name: "XGB", version: "v1", process: "quality", description: "", accuracy: "0.9", recall: "1", precision: "0", f1: "0.5" };
assert.deepEqual(validateDraft(ok, PROCESS), {});
const bad = validateDraft({ ...ok, name: " ", process: "toString", accuracy: "1.2", recall: "", f1: "abc" }, PROCESS);
assert.deepEqual(Object.keys(bad).sort(), ["accuracy", "f1", "name", "process", "recall"]);

// 알고리즘: 영문 시작, 대문자 허용 (XGB, CatB)
assert.deepEqual(validateDraft({ ...ok, name: "LGBM" }, PROCESS), {});
assert.deepEqual(validateDraft({ ...ok, name: "CatB" }, PROCESS), {});
for (const name of ["-xgb", "x gb", "casting/defect"]) assert.ok(validateDraft({ ...ok, name }, PROCESS).name, name);

assert.equal(buildModelName("DieCasting", "XGB", "2026-11-14"), "DieCasting_XGB_20261114_01");

// 배포 전환: 공정 내 1개만 deployed, applyCount 증가
{
  const deployed = MODELS.find((m) => m.deployed)!;
  const other = MODELS.find((m) => m.process === deployed.process && !m.deployed)!;
  const next = applyDeploy(MODELS, other.id);
  assert.equal(next.filter((m) => m.deployed && m.process === other.process).length, 1);
  assert.ok(next.find((m) => m.id === other.id)?.deployed);
  assert.equal(next.find((m) => m.id === other.id)?.applyCount, other.applyCount + 1);
  assert.equal(applyDeploy(next, other.id), next, "이미 배포면 동일 참조");
  const synced = syncDeployedFlags(MODELS, other.id);
  assert.equal(synced.filter((m) => m.deployed).length, 1);
  assert.ok(synced.find((m) => m.id === other.id)?.deployed);
}

// 생성일 자동 기록: 로컬 날짜 YYYY-MM-DD
assert.equal(createdAtNow(new Date(2026, 0, 5, 23, 59)), "2026-01-05");

console.log("model_management logic: OK");
