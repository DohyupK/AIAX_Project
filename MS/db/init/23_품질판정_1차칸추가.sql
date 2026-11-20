-- 23 품질 판정 결과에 1차(ML) 칸 추가 (2026-11-20, MS)
-- ai.quality_prediction = 샷 1줄에 1차·2차 결과를 나란히
--   1차(ML, 공정값)  : qc1_model_name · qc1_version · qc1_result · qc1_score · qc1_predicted_at  ← 새 칸
--   2차(DL, 사진)    : model_name · version · result · confidence_score · predicted_at          ← 기존 칸 (이름 그대로)
--   1차 불량이면 2차 검사를 안 하므로 2차 칸은 비어 있음
--   저장 순서: 1차 판정 때 줄 INSERT → 2차 판정 때 같은 줄 UPDATE (app_ai: SELECT·INSERT·UPDATE, 18 에서 부여)
-- 리포트: 1차 불량 수 = qc1_result = 'fail' 인 줄 수
-- 14 뒤에 실행. 테이블이 비어 있을 때 만듦 (2026-11-20 0행). 다시 실행해도 됨
BEGIN;

-- 1차 칸
ALTER TABLE ai.quality_prediction ADD COLUMN IF NOT EXISTS qc1_model_name   text;
ALTER TABLE ai.quality_prediction ADD COLUMN IF NOT EXISTS qc1_version      text;
ALTER TABLE ai.quality_prediction ADD COLUMN IF NOT EXISTS qc1_result       text;
ALTER TABLE ai.quality_prediction ADD COLUMN IF NOT EXISTS qc1_score        numeric(5,4);
ALTER TABLE ai.quality_prediction ADD COLUMN IF NOT EXISTS qc1_predicted_at timestamptz;

-- 2차 칸은 비어 있을 수 있게 (1차 불량 샷). 판정 시각 기본값은 1차 INSERT 때 2차 시각이 잘못 채워지지 않게 제거
ALTER TABLE ai.quality_prediction ALTER COLUMN model_name       DROP NOT NULL;
ALTER TABLE ai.quality_prediction ALTER COLUMN version          DROP NOT NULL;
ALTER TABLE ai.quality_prediction ALTER COLUMN result           DROP NOT NULL;
ALTER TABLE ai.quality_prediction ALTER COLUMN confidence_score DROP NOT NULL;
ALTER TABLE ai.quality_prediction ALTER COLUMN predicted_at     DROP NOT NULL;
ALTER TABLE ai.quality_prediction ALTER COLUMN predicted_at     DROP DEFAULT;

-- 규칙
ALTER TABLE ai.quality_prediction DROP CONSTRAINT IF EXISTS quality_prediction_qc1_model_fk;
ALTER TABLE ai.quality_prediction ADD CONSTRAINT quality_prediction_qc1_model_fk
    FOREIGN KEY (qc1_model_name, qc1_version) REFERENCES ai.model_registry (model_name, version);

ALTER TABLE ai.quality_prediction DROP CONSTRAINT IF EXISTS quality_prediction_qc1_check;
ALTER TABLE ai.quality_prediction ADD CONSTRAINT quality_prediction_qc1_check CHECK (
    (qc1_result IS NULL OR qc1_result IN ('pass', 'fail'))
    AND (qc1_score IS NULL OR qc1_score BETWEEN 0 AND 1));

-- 1차 칸은 다 있거나 다 비어 있음 / 2차 칸도 마찬가지
ALTER TABLE ai.quality_prediction DROP CONSTRAINT IF EXISTS quality_prediction_qc1_all_or_none;
ALTER TABLE ai.quality_prediction ADD CONSTRAINT quality_prediction_qc1_all_or_none CHECK (
    num_nulls(qc1_model_name, qc1_version, qc1_result, qc1_score, qc1_predicted_at) IN (0, 5));
ALTER TABLE ai.quality_prediction DROP CONSTRAINT IF EXISTS quality_prediction_qc2_all_or_none;
ALTER TABLE ai.quality_prediction ADD CONSTRAINT quality_prediction_qc2_all_or_none CHECK (
    num_nulls(model_name, version, result, confidence_score, predicted_at) IN (0, 5));

-- 줄에는 결과가 하나 이상 / 1차 불량이면 2차 없음
ALTER TABLE ai.quality_prediction DROP CONSTRAINT IF EXISTS quality_prediction_any_result;
ALTER TABLE ai.quality_prediction ADD CONSTRAINT quality_prediction_any_result CHECK (
    qc1_result IS NOT NULL OR result IS NOT NULL);
ALTER TABLE ai.quality_prediction DROP CONSTRAINT IF EXISTS quality_prediction_no_qc2_after_qc1_fail;
ALTER TABLE ai.quality_prediction ADD CONSTRAINT quality_prediction_no_qc2_after_qc1_fail CHECK (
    qc1_result IS DISTINCT FROM 'fail' OR result IS NULL);

COMMENT ON TABLE ai.quality_prediction IS
    '품질 판정 결과 (샷 1줄). 1차(ML) = qc1_* 칸, 2차(DL) = model_name·version·result·confidence_score·predicted_at. 1차 불량이면 2차 칸 비어 있음. 불량 유형은 사람이 ai.defect_label 로 따로 라벨링';
COMMENT ON COLUMN ai.quality_prediction.qc1_model_name   IS '1차(ML) 모델 이름 (ai.model_registry, CAST-QC1)';
COMMENT ON COLUMN ai.quality_prediction.qc1_version      IS '1차 모델 버전';
COMMENT ON COLUMN ai.quality_prediction.qc1_result       IS '1차 판정 pass / fail';
COMMENT ON COLUMN ai.quality_prediction.qc1_score        IS '1차 불량 확률 (0~1, 모델 기준값 이상이면 fail)';
COMMENT ON COLUMN ai.quality_prediction.qc1_predicted_at IS '1차 판정 시각';
COMMENT ON COLUMN ai.quality_prediction.model_name       IS '2차(DL) 모델 이름 (CAST-QC2). 1차 불량이면 비어 있음';
COMMENT ON COLUMN ai.quality_prediction.result           IS '2차 판정 pass / fail. 1차 불량이면 비어 있음';
COMMENT ON COLUMN ai.quality_prediction.confidence_score IS '2차 확신도 (0~1)';
COMMENT ON COLUMN ai.quality_prediction.predicted_at     IS '2차 판정 시각';

COMMIT;

-- 확인: 칸 11개
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'ai' AND table_name = 'quality_prediction'
ORDER BY ordinal_position;
