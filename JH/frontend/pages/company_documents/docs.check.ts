// 사내 문서함 규칙 자체 점검 — 실행: node JH/frontend/pages/company_documents/docs.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { CATEGORIES, MAX_FILE_BYTES, SAMPLE_DOCS, buildDocMeta, canDelete, createdAt, extOf, formatDateTime, formatSize, nextDocNo, sortDocs, validateUpload, type UploadDraft } from "./docs.ts";

// 확장자
assert.equal(extOf("보고서.최종.PDF"), "pdf");
assert.equal(extOf("README"), "");
assert.equal(extOf(".env"), ""); // 점으로 시작하는 이름은 확장자 없음

// 업로드 검증
const ok: UploadDraft = { title: " 작업표준서 ", description: "", category: "sop", grade: "internal", department: "생산팀", file: { name: "a.pdf", size: 10 } };
assert.deepEqual(validateUpload(ok), {});
assert.ok(validateUpload({ ...ok, file: null }).file);
assert.ok(validateUpload({ ...ok, file: { name: "virus.exe", size: 10 } }).file); // 허용 안 된 형식
assert.ok(validateUpload({ ...ok, file: { name: "a.pdf", size: 0 } }).file);
assert.ok(validateUpload({ ...ok, file: { name: "a.pdf", size: MAX_FILE_BYTES + 1 } }).file);
assert.deepEqual(validateUpload({ ...ok, file: { name: "a.pdf", size: MAX_FILE_BYTES } }), {}); // 경계값 허용
assert.ok(validateUpload({ ...ok, title: "   " }).title);
assert.ok(validateUpload({ ...ok, title: "x".repeat(101) }).title);
assert.ok(validateUpload({ ...ok, description: "x".repeat(501) }).description);
assert.ok(validateUpload({ ...ok, category: "" }).category);
assert.ok(validateUpload({ ...ok, grade: "secret" }).grade);
assert.ok(validateUpload({ ...ok, department: "" }).department);

// 등록: 업로더는 로그인 계정, 등록 일시는 등록 버튼 누른 시각
const now = new Date("2026-11-15T05:42:10.123Z");
assert.equal(createdAt(now), "2026-11-15T05:42:10.123Z");
const meta = buildDocMeta({ ...ok, file: { name: "a.pdf", size: 10 } }, { user_id: "E9", name: "테스터" }, "DOC-2026-0099", now);
assert.equal(meta.title, "작업표준서"); // 앞뒤 공백 제거
assert.equal(meta.uploader_id, "E9");
assert.equal(meta.uploader, "테스터");
assert.equal(meta.created_at, "2026-11-15T05:42:10.123Z");
assert.match(formatDateTime(meta.created_at), /^2026-11-15 \d{2}:42$/); // 현지 시각 (시간대에 따라 시만 다름)
assert.equal(formatDateTime("이상한값"), "이상한값");

// 삭제 권한: 본인 업로드만, 예시·비로그인 불가
const me = { user_id: "E9" };
assert.equal(canDelete({ uploader_id: "E9" }, me), true);
assert.equal(canDelete({ uploader_id: "E1" }, me), false);
assert.equal(canDelete({ uploader_id: "E9" }, null), false);
assert.equal(canDelete({ uploader_id: "E9", sample: true }, me), false);
assert.equal(canDelete({ uploader_id: undefined as unknown as string }, me), true); // 업로더 기록 전 옛 문서

// 문서 번호: 같은 연도 최대 + 1, 다른 연도·이상한 값 무시
assert.equal(nextDocNo([], 2026), "DOC-2026-0001");
assert.equal(nextDocNo(["DOC-2026-0012", "DOC-2026-0003", "DOC-2025-0099", "DOC-2026-abcd"], 2026), "DOC-2026-0013");

// 정렬: 최신 등록 시각 먼저, 같은 시각이면 번호 역순, 시간대 섞여도 시각 기준
const s = sortDocs([
  { ...SAMPLE_DOCS[0], doc_no: "DOC-2026-0001", created_at: "2026-01-01" },
  { ...SAMPLE_DOCS[0], doc_no: "DOC-2026-0003", created_at: "2026-02-01T09:00:00+09:00" },
  { ...SAMPLE_DOCS[0], doc_no: "DOC-2026-0002", created_at: "2026-02-01T00:00:00Z" },
  { ...SAMPLE_DOCS[0], doc_no: "DOC-2026-0004", created_at: "2026-02-01T00:00:01Z" },
]);
assert.deepEqual(s.map(d => d.doc_no), ["DOC-2026-0004", "DOC-2026-0003", "DOC-2026-0002", "DOC-2026-0001"]);

// 예시 문서: 번호 유일, 카테고리 모두 사용
assert.equal(new Set(SAMPLE_DOCS.map(d => d.doc_no)).size, SAMPLE_DOCS.length);
assert.deepEqual(new Set(SAMPLE_DOCS.map(d => d.category)), new Set(CATEGORIES.map(c => c.key)));

assert.equal(formatSize(512), "512 B");
assert.equal(formatSize(2048), "2 KB");
assert.equal(formatSize(5 * 1024 * 1024), "5.0 MB");

console.log("company_documents docs: OK");
