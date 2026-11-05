-- Data Mart 영역 (mart)
-- Spark가 lake 데이터를 집계해 저장. AI 학습은 이 영역만 읽는다.
-- 학습 피처(컬럼)는 데이터셋 확정 후 추가. 지금은 데이터셋과 무관한 공통 구조만 둔다.

-- LOT × 센서 요약 통계 (어떤 센서가 와도 계산 가능한 기본 피처)
CREATE TABLE mart.lot_sensor_summary (
    lot_id           text   NOT NULL,
    tag_id           bigint NOT NULL,
    sample_count     integer NOT NULL,
    value_min        double precision,
    value_max        double precision,
    value_avg        double precision,
    value_stddev     double precision,
    first_at         timestamptz,
    last_at          timestamptz,
    pipeline_run_id  bigint NOT NULL REFERENCES meta.pipeline_run (run_id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (lot_id, tag_id)
);

-- LOT 품질 결과 (품질 예측 모델의 정답값)
CREATE TABLE mart.lot_quality_label (
    lot_id        text PRIMARY KEY,
    label_value   double precision,                   -- 수치형 결과 (예: 경도)
    label_class   text,                               -- 범주형 결과 (예: OK/NG)
    judged_at     timestamptz,
    source        text,                               -- 결과 출처 (검사 시스템 등)
    created_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (label_value IS NOT NULL OR label_class IS NOT NULL)
);

-- 학습 데이터셋 버전 관리 (어떤 조건으로 만든 데이터로 학습했는지 기록)
CREATE TABLE mart.training_dataset (
    dataset_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_name     text    NOT NULL,
    version          integer NOT NULL,
    definition       jsonb   NOT NULL DEFAULT '{}'::jsonb,  -- 기간, 사용 태그, 필터 조건 등
    row_count        bigint,
    pipeline_run_id  bigint REFERENCES meta.pipeline_run (run_id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (dataset_name, version)
);

COMMENT ON TABLE mart.lot_sensor_summary IS 'LOT별 센서 요약 통계 (기본 피처)';
COMMENT ON TABLE mart.lot_quality_label  IS 'LOT 품질 결과 (학습 정답값)';
COMMENT ON TABLE mart.training_dataset   IS '학습 데이터셋 버전 이력';
