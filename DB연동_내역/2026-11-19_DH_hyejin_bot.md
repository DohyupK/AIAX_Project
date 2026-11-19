# DB 연동 — 혜진봇 Phase A (2026-11-19, DH)

| 항목 | 내용 |
|------|------|
| 기능 | 혜진봇 — 사내 문서 검색 Q&A + 출처 |
| 새 테이블 | **없음** |
| 재사용 | `org.company_document` · `document_chunk` · `document_chunk_embedding` · `document_chunk_job` |
| API | JH FastAPI `POST /api/documents/search`, 파일 `GET /api/documents/{idx}/file` (계정 `app_docs` / 기존 documents) |
| 파일 | `DOCUMENT_ROOT` (`/root/document`) — 출처 원문 다운로드 |
| 비고 | Phase A는 DH UI만. JH documents 코드 수정 없음. casting·LLM은 이후 |
