-- 사내 문서 임베딩 차원: NIM nvidia/nemotron-3-embed-1b (2048) 허용
-- OpenAI text-embedding-3-small (1536) 도 병행 허용. 공급자 전환 후 전량 재청킹 필요.
-- 서버 적용 (psql 불필요):
--   bash scripts/apply-embedding-dim-nim.sh
--   또는: cd JH/api && uv run python -m documents.apply_dim_migration
-- 이후: uv run python -m documents.requeue_all

ALTER TABLE org.document_chunk_embedding
  DROP CONSTRAINT IF EXISTS document_chunk_embedding_dim;

ALTER TABLE org.document_chunk_embedding
  ADD CONSTRAINT document_chunk_embedding_dim
  CHECK (cardinality(embedding) IN (1536, 2048));

COMMENT ON TABLE org.document_chunk_embedding IS
  '사내 문서 청크 임베딩 — NIM nemotron-3-embed-1b(2048) 우선 / OpenAI text-embedding-3-small(1536)';
