-- 사내 문서 임베딩 차원: NIM nvidia/nemotron-3-embed-1b (2048) 허용
-- OpenAI text-embedding-3-small (1536) 도 병행 허용. 공급자 전환 후 전량 재청킹 필요.
-- 서버 적용 (app_docs 또는 관리자):
--   psql "$DOCS_DATABASE_URL" -f DH/data/sql/05_document_embedding_dim_nim.pg.sql
-- 이후 JH/api 에서: uv run python -m documents.requeue_all

ALTER TABLE org.document_chunk_embedding
  DROP CONSTRAINT IF EXISTS document_chunk_embedding_dim;

ALTER TABLE org.document_chunk_embedding
  ADD CONSTRAINT document_chunk_embedding_dim
  CHECK (cardinality(embedding) IN (1536, 2048));

COMMENT ON TABLE org.document_chunk_embedding IS
  '사내 문서 청크 임베딩 — NIM nemotron-3-embed-1b(2048) 우선 / OpenAI text-embedding-3-small(1536)';
