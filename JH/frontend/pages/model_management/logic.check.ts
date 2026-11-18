// 정렬·입력 검사 자체 점검 — 실행: node JH/frontend/pages/model_management/logic.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { PROCESS, PROCESS_METRICS, type Model } from "./data.ts";
import { sortModels, validateDraft, type Draft } from "./logic.ts";

const model = (id: number, over: Partial<Model> = {}): Model => ({
  id, name: "DieCasting_XGB", version: String(id), createdAt: `2026-11-${String(10 + id).padStart(2, "0")}`,
  process: "qc1", description: "", metrics: {}, deployed: false, fileName: null, ...over,
});
const LIST = [model(1), model(2, { deployed: true }), model(3), model(4, { process: "qc2", deployed: true })];

// 배포 모델은 어떤 정렬에서도 맨 위
for (const asc of [true, false]) {
  const out = sortModels(LIST, "createdAt", asc, PROCESS);
  const firstUndeployed = out.findIndex((m) => !m.deployed);
  assert.ok(out.slice(firstUndeployed).every((m) => !m.deployed), "배포 모델 상단 고정");
  assert.equal(out.length, LIST.length);
}
// 버전은 숫자 기준 정렬 (v1.10 > v1.2)
assert.deepEqual(
  sortModels([model(1, { version: "v1.10" }), model(2, { version: "v1.2" })], "version", true, PROCESS).map((m) => m.version),
  ["v1.2", "v1.10"],
);

// 공정 이름·DB 코드 (코드 이름은 그대로, 화면 이름만 변경)
assert.deepEqual(
  Object.values(PROCESS).map((p) => [p.label, p.code]),
  [["품질 1차 검사", "CAST-OPT"], ["품질 2차 검사", "CAST-QC"], ["보호구 착용 위반", "SAFE-GATE"]],
);
// 공정별 지표: 품질 1차 = PR-AUC·Recall·Precision·F1 (DB ai.model_metric_cast_opt), 나머지 = Accuracy·Recall·Precision·F1
assert.deepEqual(PROCESS_METRICS.qc1, ["prAuc", "recall", "precision", "f1"]);
assert.deepEqual(PROCESS_METRICS.qc2, ["accuracy", "recall", "precision", "f1"]);
assert.deepEqual(PROCESS_METRICS.ppe, ["accuracy", "recall", "precision", "f1"]);

// 입력 검사: 고른 공정의 지표 4개만 검사
const ok: Draft = { name: "XGB", version: "v1", process: "qc2", description: "", accuracy: "0.9", prAuc: "", recall: "1", precision: "0", f1: "0.5" };
assert.deepEqual(validateDraft(ok, PROCESS, PROCESS_METRICS), {}, "품질 2차는 PR-AUC 비어도 통과");
assert.deepEqual(Object.keys(validateDraft({ ...ok, process: "qc1" }, PROCESS, PROCESS_METRICS)), ["prAuc"], "품질 1차는 PR-AUC 필수");
assert.deepEqual(validateDraft({ ...ok, process: "qc1", prAuc: "0.83", accuracy: "" }, PROCESS, PROCESS_METRICS), {}, "품질 1차는 Accuracy 안 받음");
const bad = validateDraft({ ...ok, name: " ", accuracy: "1.2", recall: "", f1: "abc" }, PROCESS, PROCESS_METRICS);
assert.deepEqual(Object.keys(bad).sort(), ["accuracy", "f1", "name", "recall"]);
assert.deepEqual(Object.keys(validateDraft({ ...ok, process: "toString" }, PROCESS, PROCESS_METRICS)), ["process"]);

// 알고리즘: 영문 시작, 대문자 허용 (XGB, CatB)
assert.deepEqual(validateDraft({ ...ok, name: "CatB" }, PROCESS, PROCESS_METRICS), {});
for (const name of ["-xgb", "x gb", "casting/defect"]) assert.ok(validateDraft({ ...ok, name }, PROCESS, PROCESS_METRICS).name, name);

console.log("model_management logic: OK");
