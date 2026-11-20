-- 30 품질 2차(CAST-QC2) 모델 3개 등록 + 지표 + 강건성
-- TM/model_dl/DieCasting_CNXV2T_20261117_02~04 (TM 커밋 b1a96d6)
-- 3개 모두 전처리 미포함(비교 실험용) -> deployed=false, 배포는 기존 _01 유지
-- 다시 실행해도 됨 (ON CONFLICT 갱신)
BEGIN;

INSERT INTO ai.model_registry (model_registry_idx, model_name, version, process_code, description, file_name, file_path, deployed, created_at)
SELECT (SELECT coalesce(max(model_registry_idx), 0) FROM ai.model_registry) + row_number() OVER (), v.*, false, now()
FROM (VALUES
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', 'CAST-QC2', 'ConvNeXt V2-Tiny 384 · 모델 A · 증강 없음. 전처리 미포함(비교 실험용, 서버 배포 불가)', 'DieCasting_CNXV2T_20261117_02.onnx', 'TM/model_dl/DieCasting_CNXV2T_20261117_02/DieCasting_CNXV2T_20261117_02.onnx'),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', 'CAST-QC2', 'ConvNeXt V2-Tiny 384 · 모델 C · 기하 + 뒤집기 증강. 전처리 미포함(비교 실험용, 서버 배포 불가)', 'DieCasting_CNXV2T_20261117_03.onnx', 'TM/model_dl/DieCasting_CNXV2T_20261117_03/DieCasting_CNXV2T_20261117_03.onnx'),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', 'CAST-QC2', 'ConvNeXt V2-Tiny 384 · 모델 E · 기하 + 조명 + 센서 증강. 전처리 미포함(비교 실험용, 서버 배포 불가)', 'DieCasting_CNXV2T_20261117_04.onnx', 'TM/model_dl/DieCasting_CNXV2T_20261117_04/DieCasting_CNXV2T_20261117_04.onnx')
) AS v(model_name, version, process_code, description, file_name, file_path)
ON CONFLICT (model_name, version) DO UPDATE
SET description = EXCLUDED.description, file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path;

INSERT INTO ai.model_metric_cast_qc2 (model_name, version, accuracy_score, recall_score, precision_score, f1_score) VALUES
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', 1.0000, 1.0000, 1.0000, 1.0000)
ON CONFLICT (model_name, version) DO UPDATE
SET accuracy_score = EXCLUDED.accuracy_score, recall_score = EXCLUDED.recall_score,
    precision_score = EXCLUDED.precision_score, f1_score = EXCLUDED.f1_score;

INSERT INTO ai.model_robustness (model_name, version, condition_name, accuracy_score, recall_score, precision_score, f1_score) VALUES
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '어두운 조명', 0.8308, 0.9744, 0.7917, 0.8736),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '밝은 조명', 0.9731, 0.9744, 0.9806, 0.9775),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '대비 감소', 0.9885, 0.9808, 1.0000, 0.9903),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '대비 증가', 0.9962, 1.0000, 0.9936, 0.9968),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '반사광', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '약한 흐림', 0.9769, 0.9615, 1.0000, 0.9804),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '강한 흐림', 0.8885, 0.8141, 1.0000, 0.8975),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '흔들림', 0.9538, 0.9231, 1.0000, 0.9600),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '약한 노이즈', 0.9923, 0.9872, 1.0000, 0.9935),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '강한 노이즈', 0.9846, 0.9744, 1.0000, 0.9870),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '강한 압축', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '45° 회전', 0.9615, 0.9808, 0.9563, 0.9684),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '위치 이동', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_02', 'v1.1', '0.85배 축소', 0.9962, 0.9936, 1.0000, 0.9968),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '어두운 조명', 0.9385, 0.9872, 0.9167, 0.9506),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '밝은 조명', 0.9846, 0.9936, 0.9810, 0.9873),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '대비 감소', 0.9962, 0.9936, 1.0000, 0.9968),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '대비 증가', 0.9885, 1.0000, 0.9811, 0.9905),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '반사광', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '약한 흐림', 0.9962, 0.9936, 1.0000, 0.9968),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '강한 흐림', 0.9038, 0.8397, 1.0000, 0.9129),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '흔들림', 0.9769, 0.9679, 0.9934, 0.9805),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '약한 노이즈', 0.9962, 1.0000, 0.9936, 0.9968),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '강한 노이즈', 0.9923, 0.9872, 1.0000, 0.9935),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '강한 압축', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '45° 회전', 0.9538, 0.9679, 0.9557, 0.9618),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '위치 이동', 0.9962, 0.9936, 1.0000, 0.9968),
  ('DieCasting_CNXV2T_20261117_03', 'v1.2', '0.85배 축소', 0.9962, 0.9936, 1.0000, 0.9968),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '어두운 조명', 0.9808, 0.9808, 0.9871, 0.9839),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '밝은 조명', 0.9923, 0.9872, 1.0000, 0.9935),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '대비 감소', 0.9846, 0.9744, 1.0000, 0.9870),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '대비 증가', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '반사광', 0.9962, 0.9936, 1.0000, 0.9968),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '약한 흐림', 0.9885, 0.9808, 1.0000, 0.9903),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '강한 흐림', 0.9500, 0.9167, 1.0000, 0.9565),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '흔들림', 0.9846, 0.9744, 1.0000, 0.9870),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '약한 노이즈', 0.9923, 0.9872, 1.0000, 0.9935),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '강한 노이즈', 0.9885, 0.9808, 1.0000, 0.9903),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '강한 압축', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '45° 회전', 0.9269, 0.9808, 0.9053, 0.9415),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '위치 이동', 1.0000, 1.0000, 1.0000, 1.0000),
  ('DieCasting_CNXV2T_20261117_04', 'v1.3', '0.85배 축소', 0.9846, 0.9744, 1.0000, 0.9870)
ON CONFLICT (model_name, version, condition_name) DO UPDATE
SET accuracy_score = EXCLUDED.accuracy_score, recall_score = EXCLUDED.recall_score,
    precision_score = EXCLUDED.precision_score, f1_score = EXCLUDED.f1_score;

COMMIT;

-- 확인: 2차 모델 4개, 배포는 _01 하나, 강건성 각 14줄
SELECT r.model_name, r.version, r.deployed, m.accuracy_score,
       (SELECT count(*) FROM ai.model_robustness b WHERE (b.model_name, b.version) = (r.model_name, r.version)) AS 강건성_줄
FROM ai.model_registry r
LEFT JOIN ai.model_metric_cast_qc2 m USING (model_name, version)
WHERE r.process_code = 'CAST-QC2'
ORDER BY r.model_name;
