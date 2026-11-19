-- 사내 문서함 임베딩·청킹 잡 (org). DH 2026-11-19
-- 서버 반영됨. NCP에 pgvector 시스템 패키지 없어 embedding=real[].
-- 차원 CHECK: 초기 1536 → 05_document_embedding_dim_nim.pg.sql 에서 1536|2048.
-- pgvector 설치 후: ALTER … TYPE vector(…) USING embedding::vector 검토.

CREATE TABLE IF NOT EXISTS org.document_chunk_embedding (
    document_chunk_embedding_idx integer PRIMARY KEY,
    document_chunk_idx integer NOT NULL UNIQUE
        REFERENCES org.document_chunk(document_chunk_idx) ON DELETE CASCADE,
    embedding real[] NOT NULL,
    model_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT document_chunk_embedding_dim CHECK (cardinality(embedding) IN (1536, 2048))
);
COMMENT ON TABLE org.document_chunk_embedding IS '사내 문서 청크 임베딩 (OpenAI 1536 / NIM 2048 — 05 마이그레이션 참고)';

CREATE TABLE IF NOT EXISTS org.document_chunk_job (
    company_document_idx integer PRIMARY KEY
        REFERENCES org.company_document(company_document_idx) ON DELETE CASCADE,
    chunk_status text NOT NULL CHECK (chunk_status IN ('pending', 'ok', 'retry_5m', 'midnight_pending')),
    attempt_count integer NOT NULL DEFAULT 0,
    last_error text,
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.document_chunk_job IS '문서 청킹·임베딩 재시도 상태 (2회→5분→00시 Spark)';

-- 계정 app_docs: SELECT/INSERT/UPDATE/DELETE on 위 테이블 + company_document + document_chunk
--                 SELECT on org.employee, employee_info
-- GRANT SELECT on embedding/job TO role_lake, role_spark;
