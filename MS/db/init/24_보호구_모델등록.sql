-- 24 보호구(SAFE-PPE) 모델 등록 + 지표 칸 mAP50 으로 변경 (2026-11-20, MS)
--   1) ai.model_metric_safe_ppe.accuracy_score → map50_score
--      검출 모델이라 정확도 대신 mAP50 (IoU 0.5 기준 평균 정밀도) 이 대표 지표. 1차가 pr_auc_score 를 쓰는 것과 같은 방식
--   2) 모델 4개 등록 (D:\cas_image\ppe 실험 001~004, YOLO26 미세조정, Construction-PPE 학습 800·검증 200장)
--      이름 규칙 PPE_{알고리즘}_{날짜}_{순번}, 파일 이름 = 모델 이름
--      (002·003 파일은 원래 둘 다 _01 이라 11-20 에 _02·_03 으로 바꿈)
--      지표 = 검증 200장 결과 (각 실험 metrics.json). 배포 = 004 / v1.4 (기록된 합격 기준 mAP50 ≥ 0.70·미착용 5종 재현율 ≥ 0.60 을 넘은 유일한 모델)
-- 11 뒤에 실행. 다시 실행해도 됨
BEGIN;

-- 1) 지표 칸 이름 (이미 바꿨으면 건너뜀)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'ai' AND table_name = 'model_metric_safe_ppe' AND column_name = 'accuracy_score') THEN
    ALTER TABLE ai.model_metric_safe_ppe RENAME COLUMN accuracy_score TO map50_score;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'model_metric_safe_ppe_accuracy_score_check') THEN
    ALTER TABLE ai.model_metric_safe_ppe RENAME CONSTRAINT model_metric_safe_ppe_accuracy_score_check TO model_metric_safe_ppe_map50_score_check;
  END IF;
END $$;
COMMENT ON COLUMN ai.model_metric_safe_ppe.map50_score IS 'mAP50 (검출 모델 대표 지표, 0~1)';
COMMENT ON TABLE ai.model_metric_safe_ppe IS '보호구 착용 위반(SAFE-PPE) 검출 모델 성과지표 — mAP50·Recall·Precision·F1';

-- 2) 레지스트리 (배포는 v1.4 하나 — 트리거가 같은 공정 기존 배포 해제)
INSERT INTO ai.model_registry (model_registry_idx, model_name, version, process_code, description, file_name, file_path, deployed, created_at)
SELECT (SELECT COALESCE(max(model_registry_idx), 0) FROM ai.model_registry) + v.ord,
       v.model_name, v.version, 'SAFE-PPE', v.description, v.file_name, v.file_path, v.deployed,
       TIMESTAMP '2026-11-18 00:00' AT TIME ZONE 'Asia/Seoul'
FROM (VALUES
    (1, 'PPE_YOLO26n_20261118_01', 'v1.1', '[YOLO26n] 첫 모델: 작은 모델, 입력 640px, 100 epoch (노트북 GPU)',
        'PPE_YOLO26n_20261118_01.pt', 'D:/cas_image/ppe/experiments/001_yolo26n_100epochs/PPE_YOLO26n_20261118_01.pt', false),
    (2, 'PPE_YOLO26s_20261118_02', 'v1.2', '[YOLO26s] 작은 보호구 검출을 위해 모델 키움, 입력 960px (RunPod)',
        'PPE_YOLO26s_20261118_02.pt', 'D:/cas_image/ppe/experiments/002_yolo26s_960/runpod_recovered/PPE_YOLO26s_20261118_02.pt', false),
    (3, 'PPE_YOLO26s_20261118_03', 'v1.3', '[YOLO26s] 입력 1280px 고해상도 — 검증 점수 최고, 보안경 미착용 검출 부족',
        'PPE_YOLO26s_20261118_03.pt', 'D:/cas_image/ppe/experiments/003_yolo26s_1280/runpod_result/PPE_YOLO26s_20261118_03.pt', false),
    (4, 'PPE_YOLO26s_20261118_04', 'v1.4', '[YOLO26s] 입력 960px, 약한 증강(mosaic 0.5·scale 0.3) — 합격 기준을 넘은 유일한 모델',
        'PPE_YOLO26s_20261118_04.pt', 'D:/cas_image/ppe/experiments/004_yolo26s_960_light_augmentation/runpod_result/PPE_YOLO26s_20261118_04.pt', true)
) AS v(ord, model_name, version, description, file_name, file_path, deployed)
ON CONFLICT (model_name, version) DO UPDATE
   SET process_code = EXCLUDED.process_code, description = EXCLUDED.description,
       file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path, deployed = EXCLUDED.deployed;

-- 3) 지표 (검증 200장)
DELETE FROM ai.model_metric_safe_ppe WHERE model_name LIKE 'PPE\_YOLO26%\_20261118\_%';
INSERT INTO ai.model_metric_safe_ppe (model_name, version, map50_score, recall_score, precision_score, f1_score) VALUES
    ('PPE_YOLO26n_20261118_01', 'v1.1', 0.7582, 0.6817, 0.8809, 0.7686),
    ('PPE_YOLO26s_20261118_02', 'v1.2', 0.8515, 0.7940, 0.9029, 0.8450),
    ('PPE_YOLO26s_20261118_03', 'v1.3', 0.8594, 0.8143, 0.9028, 0.8563),
    ('PPE_YOLO26s_20261118_04', 'v1.4', 0.8504, 0.7953, 0.9024, 0.8455);

COMMIT;

-- 확인: SAFE-PPE 4행 · 배포 v1.4 · 지표 4행
SELECT r.model_name, r.version, r.deployed, m.map50_score, m.recall_score, m.precision_score, m.f1_score
FROM ai.model_registry r
LEFT JOIN ai.model_metric_safe_ppe m USING (model_name, version)
WHERE r.process_code = 'SAFE-PPE'
ORDER BY r.version;
