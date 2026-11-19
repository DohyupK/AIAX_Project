-- 14 품질 2차·모델 관리·고정값 추가 (2026-11-19, MS)
-- 팀장 요청(DB 구현 추가사항): 고정값, ML/DL 결과, 강건성, 이미지 풀, LLM 피드백
-- 09(org)·11(ai)·13(casting_image) 뒤에 실행
BEGIN;

-- 고정값(단가 등). 이름-값, 날짜별 이력
CREATE TABLE org.fixed_value (
    fixed_value_idx  integer      NOT NULL UNIQUE,
    value_name       text         NOT NULL,
    value            numeric      NOT NULL,
    unit             text,
    effective_date   date         NOT NULL,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (value_name, effective_date)
);
COMMENT ON TABLE org.fixed_value IS '단가 등 고정값. 이름-값 형태, 날짜별 이력. 특정일 조회 시 effective_date <= 그날 중 최신 행 사용';
INSERT INTO org.fixed_value (fixed_value_idx, value_name, value, unit, effective_date) VALUES
  (1, '제품_단가', 85000, '원/개', '2026-08-01');
GRANT SELECT ON org.fixed_value TO role_lake, role_spark;

-- 품질 2차(DL) 검사 결과. 1차 양품 샷만 대상, 샷당 1행
CREATE TABLE ai.quality_prediction (
    casting_id        text        PRIMARY KEY REFERENCES mes.investment_casting (casting_id),
    model_name        text        NOT NULL,
    version           text        NOT NULL,
    result            text        NOT NULL CHECK (result IN ('pass', 'fail')),
    confidence_score  numeric(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    predicted_at      timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (model_name, version) REFERENCES ai.model_registry (model_name, version)
);
COMMENT ON TABLE ai.quality_prediction IS '품질 2차(DL) 검사 결과. 1차 양품 샷만 대상. 불량 유형은 사람이 ai.defect_label 로 따로 라벨링';
GRANT SELECT ON ai.quality_prediction TO role_lake, role_spark;

-- 모델 강건성(조건별 성능). Model Management 「강건성」 팝업용
CREATE TABLE ai.model_robustness (
    model_name       text        NOT NULL,
    version          text        NOT NULL,
    condition_name   text        NOT NULL,
    accuracy_score   numeric(5,4) NOT NULL CHECK (accuracy_score  BETWEEN 0 AND 1),
    recall_score     numeric(5,4) NOT NULL CHECK (recall_score    BETWEEN 0 AND 1),
    precision_score  numeric(5,4) NOT NULL CHECK (precision_score BETWEEN 0 AND 1),
    f1_score         numeric(5,4) NOT NULL CHECK (f1_score        BETWEEN 0 AND 1),
    PRIMARY KEY (model_name, version, condition_name),
    FOREIGN KEY (model_name, version) REFERENCES ai.model_registry (model_name, version) ON DELETE CASCADE
);
COMMENT ON TABLE ai.model_robustness IS '모델 강건성(조건별 성능). Model Management 「강건성」 팝업용';
GRANT SELECT ON ai.model_robustness TO role_lake, role_spark;

-- 품질 2차 검사 랜덤 매칭용 이미지 후보 풀
CREATE TABLE ai.quality_image_pool (
    pool_idx            integer     PRIMARY KEY,
    label                text        NOT NULL CHECK (label IN ('pass', 'fail')),
    image_base64         text        NOT NULL,
    content_type         text        NOT NULL DEFAULT 'image/jpeg',
    matched_casting_id   text        REFERENCES mes.investment_casting (casting_id),
    matched_at           timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE ai.quality_image_pool IS '품질 2차 검사 랜덤 매칭용 이미지 후보. 매칭되면 mes.casting_image 로 들어가고 matched_* 채움';
GRANT SELECT ON ai.quality_image_pool TO role_lake, role_spark;

-- LLM API 분석 피드백 저장 (규칙 기반 아님)
CREATE TABLE ai.llm_feedback (
    llm_feedback_idx  integer     PRIMARY KEY,
    target_type       text        NOT NULL,
    target_ref        text,
    provider          text        NOT NULL,
    model             text        NOT NULL,
    prompt            text,
    response          text        NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE ai.llm_feedback IS 'LLM API(클로드·NVIDIA NIM 등)가 분석한 결과 저장. 규칙 기반 아님';
GRANT SELECT ON ai.llm_feedback TO role_lake, role_spark;

COMMIT;
