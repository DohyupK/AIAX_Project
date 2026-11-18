-- mes.casting_image / lake.lake_casting_image 뼈대 (2026-11-19, DH)
-- 품질 이미지: Kafka E1a(Base64+메타) → Flink 모드 A → mes INSERT → spark_sync → lake 복제
-- MS/db/init 반영·서버 적용은 전달사항 참고. shift 계정으로 실행 가능.
-- original_uri: 기록만. 화면·처리는 lake 복제본(image_base64) — 원본 URI로 로드 금지.

BEGIN;

CREATE TABLE IF NOT EXISTS mes.casting_image (
    casting_id      text        PRIMARY KEY
                    REFERENCES mes.investment_casting (casting_id),
    original_uri    text,                    -- 기록 전용 (로드 금지)
    content_type    text        NOT NULL DEFAULT 'image/jpeg',
    image_base64    text        NOT NULL,    -- E1a 본문
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mes.casting_image IS '주조 샷 품질 이미지 (Kafka→Flink→mes). original_uri는 이력만, 실사용은 image_base64(및 lake 복제본)';
COMMENT ON COLUMN mes.casting_image.original_uri IS '원본 PC 주소 — 곧 삭제될 수 있음. 재조회·로드에 사용 금지';
COMMENT ON COLUMN mes.casting_image.image_base64 IS 'E1a Base64 이미지 본문';

CREATE TABLE IF NOT EXISTS lake.lake_casting_image (
    casting_id      text        PRIMARY KEY,
    original_uri    text,
    content_type    text        NOT NULL DEFAULT 'image/jpeg',
    image_base64    text        NOT NULL,
    updated_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL,
    lake_synced_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE lake.lake_casting_image IS 'mes.casting_image 복제본 — 화면/API 조회는 여기 (JH 이후 연결)';

GRANT SELECT, INSERT, UPDATE ON mes.casting_image TO role_mes;
GRANT SELECT ON mes.casting_image TO role_spark, role_lake;
GRANT SELECT, INSERT, UPDATE, DELETE ON lake.lake_casting_image TO role_spark;
GRANT SELECT ON lake.lake_casting_image TO role_lake;

COMMIT;
