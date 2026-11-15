// 불량 유형 라벨 저장 규칙 자체 점검 — 실행: node JH/frontend/pages/defect_labeling/labels.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { emptyStore, parseStore, saveLabel, sortByStatus, statusOf, toggleType, typesOf } from "./labels.ts";

// 선택 토글: 일반 유형은 여러 개, UNDECIDABLE 은 단독
assert.deepEqual(toggleType([], "BLOWHOLE"), ["BLOWHOLE"]);
assert.deepEqual(toggleType(["BLOWHOLE"], "EDGE_BURR"), ["BLOWHOLE", "EDGE_BURR"]);
assert.deepEqual(toggleType(["BLOWHOLE", "EDGE_BURR"], "BLOWHOLE"), ["EDGE_BURR"]); // 다시 누르면 해제
assert.deepEqual(toggleType(["BLOWHOLE", "EDGE_BURR"], "UNDECIDABLE"), ["UNDECIDABLE"]);
assert.deepEqual(toggleType(["UNDECIDABLE"], "SURFACE_ROUGH"), ["SURFACE_ROUGH"]);

const T = "2026-11-15T10:00:00.000Z";
let s = emptyStore();
assert.equal(statusOf(s, "line_no1", 145), "unlabeled");
assert.throws(() => saveLabel(s, "line_no1", 145, [], T)); // 선택 없으면 저장 안 함

// 라벨 저장 — 정의 순서로 정렬
s = saveLabel(s, "line_no1", 145, ["SURFACE_ROUGH", "BLOWHOLE"], T);
assert.equal(statusOf(s, "line_no1", 145), "labeled");
assert.deepEqual(typesOf(s, "line_no1", 145), ["BLOWHOLE", "SURFACE_ROUGH"]);
assert.equal(statusOf(s, "line_no2", 145), "unlabeled"); // 라인이 다르면 다른 샷

// UNDECIDABLE → 라벨 테이블에서 빠지고 폐기 테이블로 이동
s = saveLabel(s, "line_no1", 145, ["UNDECIDABLE"], T);
assert.equal(statusOf(s, "line_no1", 145), "discarded");
assert.equal(s.labels.length, 0);
assert.deepEqual(s.discards, [{ shot_id: 145, line: "line_no1", reason: "UNDECIDABLE", discarded_at: T }]);

// 폐기 샷을 다시 라벨링하면 폐기에서 빠지고 라벨로 복귀 (한 곳에만 존재)
s = saveLabel(s, "line_no1", 145, ["EDGE_BURR"], T);
assert.equal(statusOf(s, "line_no1", 145), "labeled");
assert.equal(s.discards.length + s.labels.length, 1);

// 「전체」 정렬: 미라벨 → 라벨 완료 → 폐기, 같은 상태는 원래 순서 유지
{
  let st = saveLabel(emptyStore(), "line_no1", 2, ["BLOWHOLE"], T);
  st = saveLabel(st, "line_no1", 4, ["UNDECIDABLE"], T);
  const items = [5, 4, 3, 2, 1].map(shotId => ({ shotId }));
  assert.deepEqual(sortByStatus(items, st, "line_no1").map(x => x.shotId), [5, 3, 1, 2, 4]);
}

// 저장소 값 검증: 형식이 틀린 행·모르는 유형은 버림
const parsed = parseStore({
  labels: [
    { shot_id: 1, line: "line_no1", defect_types: ["BLOWHOLE"], labeled_at: T },
    { shot_id: 2, line: "line_no1", defect_types: ["HACK"], labeled_at: T },
    { shot_id: "3", line: "line_no1", defect_types: ["BLOWHOLE"], labeled_at: T },
    { shot_id: 4, line: "line_no1", defect_types: ["UNDECIDABLE"], labeled_at: T },
  ],
  discards: [{ shot_id: 5, line: "line_no1", discarded_at: T }, { shot_id: 6 }],
});
assert.deepEqual(parsed.labels.map(r => r.shot_id), [1]);
assert.deepEqual(parsed.discards.map(r => r.shot_id), [5]);
assert.deepEqual(parseStore(null), emptyStore());
assert.deepEqual(parseStore("garbage"), emptyStore());

console.log("defect_labeling labels: OK");
