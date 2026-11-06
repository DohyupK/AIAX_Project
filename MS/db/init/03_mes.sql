-- 원본 영역 (mes)
-- 데이터셋이 확정되지 않았으므로 두 단계로 받는다.
--   1) raw_record     : Excel 한 행을 그대로 jsonb 로 저장 → 컬럼이 바뀌어도 스키마 변경 불필요
--   2) sensor_reading : 센서값을 (태그, 시각, 값) 세로형으로 저장 → 센서 개수가 바뀌어도 테이블 그대로
-- 기준정보(equipment, sensor_tag, lot)는 열처리 공정 일반 구조로 최소 컬럼만 둔다.

-- 설비 (열처리로 등)
CREATE TABLE mes.equipment (
    equipment_id    text PRIMARY KEY,                 -- 예: FURNACE-01
    equipment_name  text        NOT NULL,
    equipment_type  text,                             -- 예: 침탄로, 템퍼링로
    line_code       text,
    is_active       boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- 센서 태그 (설비별 측정 항목: 온도, 가스 유량, 탄소 농도 등)
CREATE TABLE mes.sensor_tag (
    tag_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    equipment_id  text NOT NULL REFERENCES mes.equipment (equipment_id),
    tag_code      text NOT NULL,                      -- 원본 컬럼명 그대로 (예: zone1_temp)
    unit          text,                               -- 예: degC, %, L/min
    description   text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (equipment_id, tag_code)
);

-- LOT (작업 단위)
CREATE TABLE mes.lot (
    lot_id        text PRIMARY KEY,
    equipment_id  text REFERENCES mes.equipment (equipment_id),
    recipe_code   text,                               -- 공정 조건(레시피) 식별자
    started_at    timestamptz,
    ended_at      timestamptz,
    attributes    jsonb NOT NULL DEFAULT '{}'::jsonb, -- 미확정 항목(강종, 중량 등)은 우선 여기에
    created_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX lot_equipment_started_idx ON mes.lot (equipment_id, started_at);

-- 원본 행 보관 (Excel 한 행 = 한 레코드, 가공 없이 보관)
CREATE TABLE mes.raw_record (
    record_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id       bigint NOT NULL REFERENCES meta.ingestion_batch (batch_id),
    source_row_no  integer,                           -- 원본 파일의 행 번호
    payload        jsonb  NOT NULL,                   -- {"컬럼명": 값, ...}
    ingested_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raw_record_batch_idx ON mes.raw_record (batch_id);

-- 센서 측정 원본 (시계열, 월 파티션)
-- 원본이므로 중복·이상값도 그대로 받는다. 중복 제거·검증은 lake 단계에서.
CREATE TABLE mes.sensor_reading (
    measured_at  timestamptz      NOT NULL,
    tag_id       bigint           NOT NULL REFERENCES mes.sensor_tag (tag_id),
    lot_id       text             REFERENCES mes.lot (lot_id),
    value        double precision,                    -- 결측은 NULL 그대로
    batch_id     bigint           NOT NULL REFERENCES meta.ingestion_batch (batch_id),
    ingested_at  timestamptz      NOT NULL DEFAULT now()
) PARTITION BY RANGE (measured_at);

CREATE TABLE mes.sensor_reading_default PARTITION OF mes.sensor_reading DEFAULT;
CREATE INDEX sensor_reading_tag_time_idx ON mes.sensor_reading (tag_id, measured_at);
CREATE INDEX sensor_reading_lot_idx      ON mes.sensor_reading (lot_id);
CREATE INDEX sensor_reading_batch_idx    ON mes.sensor_reading (batch_id);

COMMENT ON TABLE mes.raw_record     IS '원본 행 그대로 보관 (jsonb)';
COMMENT ON TABLE mes.sensor_reading IS '센서 측정 원본 (세로형, 월 파티션)';
