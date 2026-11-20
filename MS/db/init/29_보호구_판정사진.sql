-- 29 보호구 판정 사진 (2026-11-20, MS)
-- 판정 1건마다 사진 1장: 게이트(박스 친 화면) → Kafka aiax.ppe.frame → Flink ppe_frame_select(중요한 장면 고름)
--   → 서버 사진 받기 API POST /api/images/ppe/{판정번호} → /root/images/ppe/<판정번호>.jpg + 이 테이블
-- 중요한 장면 = 판정 3초 중 보호구 5개(착용·미착용 박스 아무거나)가 모두 잡힌 화면, 그중 신뢰도 합 최고
--               (5개 다 잡힌 화면이 없으면 가장 많이 잡힌 화면)
-- 웹: 판정 기록 행 → <img src="/api/images/ppe/{ppe_check_idx}">
-- 11·25 뒤에 실행. 다시 실행해도 됨
BEGIN;

CREATE TABLE IF NOT EXISTS ai.ppe_check_image (
    ppe_check_idx   integer       PRIMARY KEY REFERENCES ai.ppe_check (ppe_check_idx) ON DELETE CASCADE,
    image_path      text          NOT NULL,                                          -- 서버 jpg 경로
    detected_count  smallint      NOT NULL CHECK (detected_count BETWEEN 0 AND 5),  -- 그 화면에서 잡힌 보호구 수 (5 = 전부)
    score           numeric(6,4)  NOT NULL CHECK (score BETWEEN 0 AND 5),           -- 잡힌 보호구 박스 신뢰도 합
    created_at      timestamptz   NOT NULL DEFAULT now()
);
COMMENT ON TABLE  ai.ppe_check_image                IS '보호구 판정 사진 (판정 1건 = 1장). 판정 3초 중 고른 중요한 장면';
COMMENT ON COLUMN ai.ppe_check_image.image_path     IS '서버 jpg 경로 (/root/images/ppe/<판정번호>.jpg). 사진 보기 /api/images/ppe/<판정번호>';
COMMENT ON COLUMN ai.ppe_check_image.detected_count IS '그 화면에서 잡힌 보호구 수 (착용·미착용 박스 아무거나, 5 = 전부)';
COMMENT ON COLUMN ai.ppe_check_image.score          IS '잡힌 보호구 박스 신뢰도 합 (최대 5)';

GRANT SELECT ON ai.ppe_check_image TO role_lake, role_spark;
GRANT USAGE ON SCHEMA ai TO app_mes;                                   -- 사진 받기 API (IMAGE_DATABASE_URL = app_mes)
GRANT SELECT, INSERT, UPDATE ON ai.ppe_check_image TO app_mes;

COMMIT;

-- 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'ai' AND table_name = 'ppe_check_image'
ORDER BY ordinal_position;
