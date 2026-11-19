// 사내 문서함 규칙 자체 점검 — 실행: node JH/frontend/pages/company_documents/docs.check.ts (Node 23.6+)
import assert from "node:assert/strict";
import { CATEGORIES, MAX_FILE_BYTES, buildDocMeta, canDelete, createdAt, extOf, formatDateTime, formatSize, sortDocs, validateUpload, type DocMeta, type UploadDraft } from "./docs.ts";

assert.equal(extOf("보고서.최종.PDF"), "pdf");
assert.equal(extOf("README"), "");
assert.equal(extOf(".env"), "");

const ok: UploadDraft = { title: " 작업표준서 ", category: "sop", file: { name: "a.pdf", size: 10 } };
assert.deepEqual(validateUpload(ok), {});
assert.ok(validateUpload({ ...ok, file: null }).file);
assert.ok(validateUpload({ ...ok, file: { name: "virus.exe", size: 10 } }).file);
assert.ok(validateUpload({ ...ok, file: { name: "a.pdf", size: 0 } }).file);
assert.ok(validateUpload({ ...ok, file: { name: "a.pdf", size: MAX_FILE_BYTES + 1 } }).file);
assert.deepEqual(validateUpload({ ...ok, file: { name: "a.pdf", size: MAX_FILE_BYTES } }), {});
assert.ok(validateUpload({ ...ok, title: "   " }).title);
assert.ok(validateUpload({ ...ok, title: "x".repeat(101) }).title);
assert.ok(validateUpload({ ...ok, category: "" }).category);

const now = new Date("2026-11-15T05:42:10.123Z");
assert.equal(createdAt(now), "2026-11-15T05:42:10.123Z");
const meta = buildDocMeta({ ...ok, file: { name: "a.pdf", size: 10 } }, { user_id: "e0001", name: "김지환" }, now);
assert.equal(meta.title, "작업표준서");
assert.equal(meta.uploader_id, "e0001");
assert.equal(meta.uploader, "김지환");
assert.match(formatDateTime(meta.created_at), /^2026-11-15 \d{2}:42$/);
assert.equal(formatDateTime("이상한값"), "이상한값");

const me = { user_id: "e0001" };
assert.equal(canDelete({ uploader_id: "e0001" }, me), true);
assert.equal(canDelete({ uploader_id: "e0002" }, me), false);
assert.equal(canDelete({ uploader_id: "e0001" }, null), false);

const base: DocMeta = {
  doc_no: "DOC-1", title: "t", category: "sop", uploader_id: "e0001", uploader: "김지환",
  created_at: "2026-01-01", file_name: "a.pdf", file_size: 1,
};
const s = sortDocs([
  { ...base, doc_no: "DOC-1", created_at: "2026-01-01" },
  { ...base, doc_no: "DOC-3", created_at: "2026-02-01T09:00:00+09:00" },
  { ...base, doc_no: "DOC-2", created_at: "2026-02-01T00:00:00Z" },
  { ...base, doc_no: "DOC-4", created_at: "2026-02-01T00:00:01Z" },
]);
assert.deepEqual(s.map(d => d.doc_no), ["DOC-4", "DOC-3", "DOC-2", "DOC-1"]);
assert.equal(CATEGORIES.length, 7);

assert.equal(formatSize(512), "512 B");
assert.equal(formatSize(2048), "2 KB");
assert.equal(formatSize(5 * 1024 * 1024), "5.0 MB");

console.log("company_documents docs: OK");
