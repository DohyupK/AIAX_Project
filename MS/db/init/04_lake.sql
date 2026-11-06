-- Data Lake 영역 (lake)
-- Spark가 mes 원본을 정제해 저장. (태그, 시각) 기준 중복 제거 + 품질 플래그 부여

CREATE TABLE lake.sensor_reading (
    measured_at      timestamptz      NOT NULL,
    tag_id           bigint           NOT NULL,       -- mes.sensor_tag.tag_id
    lot_id           text,
    value            double precision,
    quality_flag     smallint         NOT NULL DEFAULT 0
                     CHECK (quality_flag IN (0, 1, 2, 3)),
                     -- 0=정상 1=보간 2=이상값 3=결측
    pipeline_run_id  bigint           NOT NULL REFERENCES meta.pipeline_run (run_id),
    processed_at     timestamptz      NOT NULL DEFAULT now(),
    PRIMARY KEY (tag_id, measured_at)                 -- 같은 센서·같은 시각은 1건만
) PARTITION BY RANGE (measured_at);

CREATE TABLE lake.sensor_reading_default PARTITION OF lake.sensor_reading DEFAULT;
CREATE INDEX lake_sensor_reading_lot_idx ON lake.sensor_reading (lot_id);

-- 정제된 LOT 정보 (원본 LOT에서 시간 보정·누락 처리 등을 거친 결과)
CREATE TABLE lake.lot (
    lot_id           text PRIMARY KEY,
    equipment_id     text,
    recipe_code      text,
    started_at       timestamptz,
    ended_at         timestamptz,
    duration_sec     integer GENERATED ALWAYS AS
                     (EXTRACT(EPOCH FROM (ended_at - started_at))::integer) STORED,
    attributes       jsonb  NOT NULL DEFAULT '{}'::jsonb,
    pipeline_run_id  bigint NOT NULL REFERENCES meta.pipeline_run (run_id),
    processed_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE lake.sensor_reading IS '정제된 센서 데이터 (중복 제거, 품질 플래그)';
COMMENT ON TABLE lake.lot            IS '정제된 LOT 정보';
