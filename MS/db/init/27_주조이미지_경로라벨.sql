-- 27 주조 이미지 서버 파일 경로·라벨 칸 (2026-11-20, MS)
-- 흐름: MS PC image_sender → Kafka → Flink image_ingest → 서버 이미지 API (POST /api/images)
--       → 서버가 jpg 를 /root/images/L{라인}/{yymmdd}/{casting_id}.jpg 에 저장 + 이 테이블에 기록
-- image_base64 는 그대로 둠 (JH 품질 2차 검사가 읽음). 파일 경로·라벨만 추가, 둘 다 비어 있어도 됨 (예전 행)
-- 13 뒤에 실행. 다시 실행해도 됨
BEGIN;

ALTER TABLE mes.casting_image ADD COLUMN IF NOT EXISTS image_path  text;
ALTER TABLE mes.casting_image ADD COLUMN IF NOT EXISTS image_label text;

ALTER TABLE mes.casting_image DROP CONSTRAINT IF EXISTS casting_image_label_check;
ALTER TABLE mes.casting_image ADD CONSTRAINT casting_image_label_check
    CHECK (image_label IS NULL OR image_label IN ('ok', 'defect'));

COMMENT ON COLUMN mes.casting_image.image_path  IS '서버 jpg 파일 경로 (/root/images/L1/261120/<casting_id>.jpg). 서버 이미지 API 가 채움';
COMMENT ON COLUMN mes.casting_image.image_label IS '붙인 사진의 정답 ok(양품 사진) / defect(불량 사진). 시연용 — 실제 판정은 ai.quality_prediction';

COMMIT;

-- 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'mes' AND table_name = 'casting_image'
ORDER BY ordinal_position;
