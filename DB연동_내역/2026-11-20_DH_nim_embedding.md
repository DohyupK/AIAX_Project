# DB 연동 — NIM 임베딩 차원 (2026-11-20, DH)

| 항목 | 내용 |
|------|------|
| 기능 | 사내 문서·혜진봇 — NVIDIA NIM 우선 임베딩/Chat |
| SQL | [`DH/data/sql/05_document_embedding_dim_nim.pg.sql`](../DH/data/sql/05_document_embedding_dim_nim.pg.sql) — CHECK `1536\|2048` |
| 재사용 | `org.document_chunk_embedding` · `document_chunk_job` |
| 재청킹 | `cd JH/api && uv run python -m documents.requeue_all` (전 문서 pending 스케줄) |
| env | `NVIDIA_API_KEY` 우선, 없으면 `OPENAI_API_KEY` |
| 비고 | 기존 OpenAI 1536 벡터와 NIM 2048 혼용 검색 안 함(차원 필터). 전환 후 재임베딩 필수 |
