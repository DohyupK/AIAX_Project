# DB 연동 — 혜진봇 Phase B ask (2026-11-20, DH)

| 항목 | 내용 |
|------|------|
| 기능 | 혜진봇 — 문서 검색 + OpenAI Chat 답변 + 출처 |
| 새 테이블 | **없음** |
| 재사용 | `org.company_document` · `document_chunk` · `document_chunk_embedding` · `document_chunk_job` |
| API | JH FastAPI `POST /api/documents/ask` (내부 검색+_retrieve_hits + Chat), 파일 `GET /api/documents/{idx}/file` (`app_docs`) |
| 파일 | `DOCUMENT_ROOT` — 출처 원문 다운로드 |
| 비고 | Phase A `search` 유지. Chat 모델 `gpt-4o-mini`. 키 `OPENAI_API_KEY` (임베딩과 공용). casting 미연동 |
