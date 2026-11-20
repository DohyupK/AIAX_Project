-- 19 사내 문서함 임베딩·청킹 상태 + app_docs 계정 (2026-11-19, DH 서버 반영 → MS init 편입)
-- 원본: DH/data/sql/04_company_document_embedding.pg.sql, 요청: DH/전달사항/2026-11-19_MS_문서청킹_자정Spark연동.md
-- 15(사내 문서함) 뒤에 실행. 비밀번호는 psql 변수 docs_pw 로 받음 (파일·채팅에 적지 않음)
-- 실행: psql ... -v docs_pw=실제비번 -f 19_사내문서함_임베딩.sql
-- NCP 에 pgvector 시스템 패키지가 없어 embedding 은 real[1536]. 설치 후 vector(1536) 전환 검토 (DH)
BEGIN;

-- 문서 조각별 OpenAI 임베딩 (text-embedding-3-small, 1536차원)
CREATE TABLE org.document_chunk_embedding (
    document_chunk_embedding_idx integer     PRIMARY KEY,
    document_chunk_idx           integer     NOT NULL UNIQUE
                                 REFERENCES org.document_chunk(document_chunk_idx) ON DELETE CASCADE,
    embedding                    real[]      NOT NULL,
    model_name                   text        NOT NULL,
    created_at                   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT document_chunk_embedding_dim CHECK (cardinality(embedding) = 1536)
);
COMMENT ON TABLE org.document_chunk_embedding IS '사내 문서 청크 OpenAI 임베딩 (text-embedding-3-small, 1536)';

-- 문서별 청킹·임베딩 상태 (즉시 2회 → 5분 후 1회 → 실패 시 자정 재처리)
CREATE TABLE org.document_chunk_job (
    company_document_idx integer     PRIMARY KEY
                         REFERENCES org.company_document(company_document_idx) ON DELETE CASCADE,
    chunk_status         text        NOT NULL CHECK (chunk_status IN ('pending', 'ok', 'retry_5m', 'midnight_pending')),
    attempt_count        integer     NOT NULL DEFAULT 0,
    last_error           text,
    updated_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.document_chunk_job IS '문서 청킹·임베딩 재시도 상태 (2회→5분→00시 재처리)';

GRANT SELECT ON org.document_chunk_embedding, org.document_chunk_job TO role_lake, role_spark;

-- app_docs: 사내 문서함 API (JH/api/documents) 전용 — 문서 테이블 4개 읽기·쓰기 + 작성자 확인용 사원 읽기
CREATE ROLE app_docs LOGIN PASSWORD :'docs_pw';
GRANT CONNECT ON DATABASE aiax TO app_docs;
GRANT USAGE ON SCHEMA org TO app_docs;
GRANT SELECT, INSERT, UPDATE, DELETE ON org.company_document, org.document_chunk,
                                        org.document_chunk_embedding, org.document_chunk_job TO app_docs;
GRANT SELECT ON org.employee, org.employee_info TO app_docs;

COMMIT;
