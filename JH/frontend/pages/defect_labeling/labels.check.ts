// 불량 유형 선택·정렬 규칙 자체 점검 — 실행: node JH/frontend/pages/defect_labeling/labels.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { sortByStatus, toggleType, typesOf, type DefectShot } from "./labels.ts";

// 선택 토글: 일반 유형은 여러 개, UNDECIDABLE 은 단독
assert.deepEqual(toggleType([], "BLOWHOLE"), ["BLOWHOLE"]);
assert.deepEqual(toggleType(["BLOWHOLE"], "EDGE_BURR"), ["BLOWHOLE", "EDGE_BURR"]);
assert.deepEqual(toggleType(["BLOWHOLE", "EDGE_BURR"], "BLOWHOLE"), ["EDGE_BURR"]); // 다시 누르면 해제
assert.deepEqual(toggleType(["BLOWHOLE", "EDGE_BURR"], "UNDECIDABLE"), ["UNDECIDABLE"]);
assert.deepEqual(toggleType(["UNDECIDABLE"], "SURFACE_ROUGH"), ["SURFACE_ROUGH"]);

const shot = (shotId: number, status: DefectShot["status"], types: DefectShot["types"] = []): DefectShot =>
  ({ castingId: `261011_000000_${shotId}`, shotId, time: "0:00:00", status, types });

// 저장된 유형: 폐기면 UNDECIDABLE, 라벨 완료면 그 유형, 미라벨이면 없음
assert.deepEqual(typesOf(shot(1, "discarded")), ["UNDECIDABLE"]);
assert.deepEqual(typesOf(shot(2, "labeled", ["BLOWHOLE", "SURFACE_ROUGH"])), ["BLOWHOLE", "SURFACE_ROUGH"]);
assert.deepEqual(typesOf(shot(3, "unlabeled")), []);

// 「전체」 정렬: 미라벨 → 라벨 완료 → 폐기, 같은 상태는 원래 순서 유지
const items = [shot(5, "unlabeled"), shot(4, "discarded"), shot(3, "unlabeled"), shot(2, "labeled", ["BLOWHOLE"]), shot(1, "unlabeled")];
assert.deepEqual(sortByStatus(items).map(x => x.shotId), [5, 3, 1, 2, 4]);

console.log("defect_labeling labels: OK");
