-- 품질 2차(DL) 모델 등록 + 성과지표 + 강건성 — 2026-11-19, JH 작성 (사용자 승인: 배포 상태로 등록)
-- 근거: TM 회신 TM/전달사항/2026-11-19_JH_품질2차_DL모델_회신.md
--       강건성 값 = TM/model_dl/DieCasting_CNXV2T_20261117_01/DieCasting_CNXV2T_20261117_01_robustness.csv
-- 실행: MS 또는 DH 가 관리자 계정으로 (JH API 계정 app_lake 는 ai 읽기만 — 쓰기 계정 생기기 전 관리 작업)
-- 실행 전 확인(MS): 이 파일은 리포 문서 기준으로 작성 — 서버 칼럼과 다르면 알려 주세요
--   · ai.model_registry.model_registry_idx 에 자동 증가(default)가 없다고 보고 최대값 + 1 로 넣음
--   · ai.model_metric_cast_qc2 / ai.model_robustness 칼럼 = model_name, version, (condition_name,) *_score 만 필요하다고 봄
-- 다시 실행해도 안전 (registry 는 ON CONFLICT, 지표·강건성은 이 모델 행만 지우고 다시 넣음)

BEGIN;

-- 1. 레지스트리 — deployed = true: 트리거 trg_model_registry_deploy 가 같은 공정(CAST-QC2) 기존 배포를 해제
INSERT INTO ai.model_registry (model_registry_idx, model_name, version, process_code, description, file_name, deployed)
SELECT COALESCE(MAX(model_registry_idx), 0) + 1,
       'DieCasting_CNXV2T_20261117_01', 'v1', 'CAST-QC2',
       'ConvNeXt V2-Tiny 기반 주조품 윗면 사진 불량/양품 이진 분류 모델 (기하·조명 증강, 전처리 포함 ONNX, 불량 확률 ≥ 0.5 → 불량)',
       'DieCasting_CNXV2T_20261117_01.onnx', true
FROM ai.model_registry
ON CONFLICT (model_name, version) DO UPDATE
   SET process_code = EXCLUDED.process_code, description = EXCLUDED.description,
       file_name = EXCLUDED.file_name, deployed = true;

-- 2. 성과지표 (격리 테스트셋 260장)
DELETE FROM ai.model_metric_cast_qc2 WHERE (model_name, version) = ('DieCasting_CNXV2T_20261117_01', 'v1');
INSERT INTO ai.model_metric_cast_qc2 (model_name, version, accuracy_score, recall_score, precision_score, f1_score)
VALUES ('DieCasting_CNXV2T_20261117_01', 'v1', 1.0000, 1.0000, 1.0000, 1.0000);

-- 3. 강건성 14개 조건 (조건 이름은 화면 logic.ts ROBUSTNESS_ORDER 와 글자까지 같음)
DELETE FROM ai.model_robustness WHERE (model_name, version) = ('DieCasting_CNXV2T_20261117_01', 'v1');
INSERT INTO ai.model_robustness (model_name, version, condition_name, accuracy_score, recall_score, precision_score, f1_score)
SELECT 'DieCasting_CNXV2T_20261117_01', 'v1', c.*
FROM (VALUES
    ('어두운 조명', 0.9846, 0.9808, 0.9935, 0.9871),
    ('밝은 조명',   0.9962, 0.9936, 1.0000, 0.9968),
    ('대비 감소',   0.9923, 0.9872, 1.0000, 0.9935),
    ('대비 증가',   0.9885, 1.0000, 0.9811, 0.9905),
    ('반사광',      1.0000, 1.0000, 1.0000, 1.0000),
    ('약한 흐림',   1.0000, 1.0000, 1.0000, 1.0000),
    ('강한 흐림',   0.9423, 0.9038, 1.0000, 0.9495),
    ('흔들림',      0.9846, 0.9744, 1.0000, 0.9870),
    ('약한 노이즈', 0.9923, 0.9936, 0.9936, 0.9936),
    ('강한 노이즈', 0.9885, 0.9872, 0.9935, 0.9904),
    ('강한 압축',   1.0000, 1.0000, 1.0000, 1.0000),
    ('45° 회전',    0.9538, 0.9744, 0.9500, 0.9620),
    ('위치 이동',   1.0000, 1.0000, 1.0000, 1.0000),
    ('0.85배 축소', 0.9962, 0.9936, 1.0000, 0.9968)
) AS c(condition_name, accuracy_score, recall_score, precision_score, f1_score);

-- 확인: 1행 / 1행 / 14행, CAST-QC2 배포 1개
SELECT model_registry_idx, model_name, version, process_code, deployed FROM ai.model_registry WHERE process_code = 'CAST-QC2';
SELECT count(*) AS robustness_rows FROM ai.model_robustness WHERE (model_name, version) = ('DieCasting_CNXV2T_20261117_01', 'v1');

COMMIT;
