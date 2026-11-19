-- 15 사내 문서함 — 문서 저장 + LLM 참조용 청크 (2026-11-19, MS)
-- DH 요청: 사내 문서함 DB가 비어있음(권한 테이블만 있고 문서 저장 테이블이 없음).
--   문서 파일·메타, 그리고 LLM이 참조할 청크·메타데이터 필요.
-- 09(org) 뒤에 실행
BEGIN;

-- 문서 (파일 자체는 NAS/서버에 두고, DB엔 경로만)
CREATE TABLE org.company_document (
    company_document_idx  integer      NOT NULL UNIQUE,
    title                  text         NOT NULL,
    category               text,                                             -- 예: 보고서, 매뉴얼, 양식 (선택지 미정)
    file_path              text         NOT NULL,                            -- 서버/NAS 저장 경로
    file_name              text         NOT NULL,
    uploaded_by            text         NOT NULL REFERENCES org.employee(employee_no),
    uploaded_at            timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (company_document_idx)
);
COMMENT ON TABLE org.company_document IS '사내 문서함 — 문서 메타. 파일 자체는 file_path가 가리키는 NAS/서버에 있음';

-- 청크 (LLM이 문서를 참조할 때 쓰는 잘게 쪼갠 텍스트 조각)
CREATE TABLE org.document_chunk (
    document_chunk_idx    integer      NOT NULL UNIQUE,
    company_document_idx  integer      NOT NULL REFERENCES org.company_document(company_document_idx) ON DELETE CASCADE,
    chunk_no               integer      NOT NULL,                            -- 문서 내 순서 (0부터)
    content                 text         NOT NULL,                            -- 조각낸 텍스트
    created_at              timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (document_chunk_idx),
    UNIQUE (company_document_idx, chunk_no)
);
COMMENT ON TABLE org.document_chunk IS '문서를 잘게 쪼갠 텍스트 조각 + 메타데이터. LLM이 문서 내용을 스스로 참조(검색)할 때 사용';

GRANT SELECT ON org.company_document, org.document_chunk TO role_lake, role_spark;

COMMIT;
