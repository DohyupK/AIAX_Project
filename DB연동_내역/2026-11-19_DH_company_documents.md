# DB 연동 — 사내 문서함 (2026-11-19, DH·JH)

| 항목 | 내용 |
|------|------|
| 기능 | 사내 문서함 업로드·목록·다운로드·삭제·의미검색 |
| 계정 | 쓰기 `app_docs` (`DOCS_DATABASE_URL`), 사원 조회 동일 계정 SELECT / 참고 `app_hr` |
| 파일 | `DOCUMENT_ROOT` (NCP `/document`, 로컬 `C:\document`) — DB 밖 |
| OpenAI | 루트 `.env` → **`OPENAI_API_KEY`** (Embeddings `sk-...`). 비어 있으면 임베딩·의미검색 불가. 서버 스니펫: `scripts/server-env.snippet.env` |

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 | 비고 |
|----------|-----------|-----------|------|------|
| `org.company_document` | idx, title, category, file_path, file_name, uploaded_by→employee, uploaded_at | 쓰기 app_docs | `JH/api/documents` | 기존 |
| `org.document_chunk` | idx, company_document_idx, chunk_no, content | 쓰기 app_docs | BG 청킹 | 기존 |
| `org.document_chunk_embedding` | idx, document_chunk_idx, embedding real[1536], model_name | 쓰기 app_docs | BG 임베딩·검색 | **신규**. pgvector 미설치 |
| `org.document_chunk_job` | company_document_idx PK, chunk_status, attempt_count, last_error | 쓰기 app_docs | 2회→5분→midnight | **신규** |

API: `GET/POST /api/documents`, `GET/DELETE /api/documents/{idx}`, `POST /api/documents/search`  
재청킹 CLI: `uv run python -m documents.rechunk` (00시 MS 연동 요청: `DH/전달사항/2026-11-19_MS_문서청킹_자정Spark연동.md`)
