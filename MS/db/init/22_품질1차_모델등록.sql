-- 22 품질 1차(ML) 모델 등록 — TM 모델 목록 56개 + 배포 모델 (2026-11-20, MS)
-- 근거: TM 정리표 model_summary (파일명·모델명·버전·한줄설명·PR_AUC·Precision·Recall·F1)
--       모델 파일은 Git 저장소 TM/model_ml/<모델명>/ 에 그대로 둠 (서버 모델 폴더가 생기면 file_path 만 바꿈)
-- 배포: DieCasting_XGB_20261114_09 / v17.2 (TM README 「운영(배포) 모델」, 전체 100% 학습)
--       지표는 같은 설정의 검증모델 _10 (v17.1) Test 성적 (평가 데이터가 없어서)
-- 예외: DieCasting_XGB_20261109_25 — 저장소에 파일 없음 → file_name·file_path 비움
--       DieCasting_XGB_20261107_01 — 파일은 있지만 정리표에 없음(지표 없음) → 등록 안 함
-- created_at = 모델 이름의 날짜 (학습일). 처음 등록(11-20 오전)한 _09 / v1 은 v17.2 로 교체
-- 관리자 계정으로 실행. 다시 실행해도 됨 (같은 이름·버전은 내용만 갱신)
-- 목록을 임시 테이블에 담아 두 번(레지스트리·지표) 씀. DBeaver 자동 커밋이어도 지워지지 않게 ON COMMIT DROP 안 씀
DROP TABLE IF EXISTS qc1_models;
CREATE TEMP TABLE qc1_models (model_name text, version text, description text, file_name text, file_path text,
                              trained date, pr_auc numeric, prec numeric, rec numeric, f1 numeric);
INSERT INTO qc1_models VALUES
    ('DieCasting_RF_20261109_01', 'v1.1', '[RandomForest] 변수 중요도 계산용: 원본+파생 72개 전부 (변수 선택의 출발점)', 'DieCasting_RF_20261109_01.joblib', 'TM/model_ml/DieCasting_RF_20261109_01/DieCasting_RF_20261109_01.joblib', DATE '2026-11-09', 0.8365, 0.9855, 0.5859, 0.7349),
    ('DieCasting_XGB_20261109_01', 'v1.2', '[XGBoost] 변수 중요도 계산용: 원본+파생 72개 전부 (변수 선택의 출발점)', 'DieCasting_XGB_20261109_01.joblib', 'TM/model_ml/DieCasting_XGB_20261109_01/DieCasting_XGB_20261109_01.joblib', DATE '2026-11-09', 0.8339, 0.9776, 0.6735, 0.7976),
    ('DieCasting_XGB_20261109_02', 'v1.3', '[XGBoost] 정상 압력 샷만으로 72개 전부 학습 (어려운 불량 전용 기준선)', 'DieCasting_XGB_20261109_02.joblib', 'TM/model_ml/DieCasting_XGB_20261109_02/DieCasting_XGB_20261109_02.joblib', DATE '2026-11-09', 0.4340, 0.5455, 0.3967, 0.4593),
    ('DieCasting_XGB_20261109_03', 'v1.4', '[XGBoost] M1: 72개 전부 사용 (선택 없이 넣었을 때 기준)', 'DieCasting_XGB_20261109_03.joblib', 'TM/model_ml/DieCasting_XGB_20261109_03/DieCasting_XGB_20261109_03.joblib', DATE '2026-11-09', 0.8339, 0.9776, 0.6735, 0.7976),
    ('DieCasting_XGB_20261109_04', 'v1.5', '[XGBoost] M1: 72개 전부 사용 (선택 없이 넣었을 때 기준) — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_04.joblib', 'TM/model_ml/DieCasting_XGB_20261109_04/DieCasting_XGB_20261109_04.joblib', DATE '2026-11-09', 0.4340, 0.5455, 0.3967, 0.4593),
    ('DieCasting_XGB_20261109_05', 'v1.6', '[XGBoost] M2: 효과크기 |δ| ≥ 0.15인 통계 기준 40개', 'DieCasting_XGB_20261109_05.joblib', 'TM/model_ml/DieCasting_XGB_20261109_05/DieCasting_XGB_20261109_05.joblib', DATE '2026-11-09', 0.8164, 0.9559, 0.6701, 0.7879),
    ('DieCasting_XGB_20261109_06', 'v1.7', '[XGBoost] M2: 효과크기 |δ| ≥ 0.15인 통계 기준 40개 — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_06.joblib', 'TM/model_ml/DieCasting_XGB_20261109_06/DieCasting_XGB_20261109_06.joblib', DATE '2026-11-09', 0.4042, 0.5814, 0.3099, 0.4043),
    ('DieCasting_XGB_20261109_07', 'v1.8', '[XGBoost] M3: 상호정보량(MI) 상위 15개', 'DieCasting_XGB_20261109_07.joblib', 'TM/model_ml/DieCasting_XGB_20261109_07/DieCasting_XGB_20261109_07.joblib', DATE '2026-11-09', 0.8180, 0.9391, 0.6890, 0.7948),
    ('DieCasting_XGB_20261109_08', 'v1.9', '[XGBoost] M3: 상호정보량(MI) 상위 15개 — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_08.joblib', 'TM/model_ml/DieCasting_XGB_20261109_08/DieCasting_XGB_20261109_08.joblib', DATE '2026-11-09', 0.3581, 0.5971, 0.3430, 0.4357),
    ('DieCasting_XGB_20261109_09', 'v1.10', '[XGBoost] M4: 모델 중요도(Permutation·SHAP) 상위 15개', 'DieCasting_XGB_20261109_09.joblib', 'TM/model_ml/DieCasting_XGB_20261109_09/DieCasting_XGB_20261109_09.joblib', DATE '2026-11-09', 0.8441, 0.8098, 0.7680, 0.7884),
    ('DieCasting_XGB_20261109_10', 'v1.11', '[XGBoost] M4: 모델 중요도(Permutation·SHAP) 상위 15개 — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_10.joblib', 'TM/model_ml/DieCasting_XGB_20261109_10/DieCasting_XGB_20261109_10.joblib', DATE '2026-11-09', 0.4052, 0.4410, 0.4174, 0.4289),
    ('DieCasting_XGB_20261109_11', 'v1.12', '[XGBoost] M5: 통계·MI·모델 중요도를 종합한 25개', 'DieCasting_XGB_20261109_11.joblib', 'TM/model_ml/DieCasting_XGB_20261109_11/DieCasting_XGB_20261109_11.joblib', DATE '2026-11-09', 0.8302, 0.9946, 0.6323, 0.7731),
    ('DieCasting_XGB_20261109_12', 'v1.13', '[XGBoost] M5: 통계·MI·모델 중요도를 종합한 25개 — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_12.joblib', 'TM/model_ml/DieCasting_XGB_20261109_12/DieCasting_XGB_20261109_12.joblib', DATE '2026-11-09', 0.3771, 0.4889, 0.3636, 0.4171),
    ('DieCasting_XGB_20261109_13', 'v1.14', '[XGBoost] M5 + 비스켓 두께 (측정 시점 누수 의심 변수 추가 비교)', 'DieCasting_XGB_20261109_13.joblib', 'TM/model_ml/DieCasting_XGB_20261109_13/DieCasting_XGB_20261109_13.joblib', DATE '2026-11-09', 0.8505, 0.9873, 0.6701, 0.7984),
    ('DieCasting_XGB_20261109_14', 'v1.15', '[XGBoost] M5 + 비스켓 두께 (측정 시점 누수 의심 변수 추가 비교) — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_14.joblib', 'TM/model_ml/DieCasting_XGB_20261109_14/DieCasting_XGB_20261109_14.joblib', DATE '2026-11-09', 0.4765, 0.5340, 0.4545, 0.4911),
    ('DieCasting_XGB_20261109_15', 'v1.16', '[XGBoost] M5 종합 25개를 무작위 분할로 학습 (시간 분할 대비 낙관 편향 확인용)', 'DieCasting_XGB_20261109_15.joblib', 'TM/model_ml/DieCasting_XGB_20261109_15/DieCasting_XGB_20261109_15.joblib', DATE '2026-11-09', 0.9071, 0.8178, 0.8719, 0.8440),
    ('DieCasting_XGB_20261109_16', 'v2.1', '[XGBoost] M5 개정판 19개 (슬리브 온도 포함)', 'DieCasting_XGB_20261109_16.joblib', 'TM/model_ml/DieCasting_XGB_20261109_16/DieCasting_XGB_20261109_16.joblib', DATE '2026-11-09', 0.8199, 0.9133, 0.7062, 0.7965),
    ('DieCasting_XGB_20261109_17', 'v2.2', '[XGBoost] M5 개정판 19개 (슬리브 온도 포함) — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_17.joblib', 'TM/model_ml/DieCasting_XGB_20261109_17/DieCasting_XGB_20261109_17.joblib', DATE '2026-11-09', 0.3897, 0.6061, 0.3306, 0.4278),
    ('DieCasting_XGB_20261109_18', 'v2.3', '[XGBoost] M5 개정판 18개 (기간 패턴을 외운 슬리브 온도 제외)', 'DieCasting_XGB_20261109_18.joblib', 'TM/model_ml/DieCasting_XGB_20261109_18/DieCasting_XGB_20261109_18.joblib', DATE '2026-11-09', 0.8009, 0.9544, 0.6478, 0.7718),
    ('DieCasting_XGB_20261109_19', 'v2.4', '[XGBoost] M5 개정판 18개 (기간 패턴을 외운 슬리브 온도 제외) — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_19.joblib', 'TM/model_ml/DieCasting_XGB_20261109_19/DieCasting_XGB_20261109_19.joblib', DATE '2026-11-09', 0.3610, 0.5804, 0.3430, 0.4312),
    ('DieCasting_XGB_20261109_20', 'v2.5', '[XGBoost] M5 개정판 + 비스켓 두께 20개', 'DieCasting_XGB_20261109_20.joblib', 'TM/model_ml/DieCasting_XGB_20261109_20/DieCasting_XGB_20261109_20.joblib', DATE '2026-11-09', 0.8323, 0.8722, 0.7388, 0.8000),
    ('DieCasting_XGB_20261109_21', 'v2.6', '[XGBoost] M5 개정판 + 비스켓 두께 20개 — 정상 조건 샷 전용', 'DieCasting_XGB_20261109_21.joblib', 'TM/model_ml/DieCasting_XGB_20261109_21/DieCasting_XGB_20261109_21.joblib', DATE '2026-11-09', 0.3883, 0.4062, 0.4298, 0.4177),
    ('DieCasting_XGB_20261109_22', 'v3.1', '[XGBoost] 원본 절대값 14개만 (런 내 편차 비교 기준)', 'DieCasting_XGB_20261109_22.joblib', 'TM/model_ml/DieCasting_XGB_20261109_22/DieCasting_XGB_20261109_22.joblib', DATE '2026-11-09', 0.3665, 0.6701, 0.2686, 0.3835),
    ('DieCasting_XGB_20261109_23', 'v3.2', '[XGBoost] 절대값 14개 + 런 내 편차 10개 (런마다 바뀌는 기준선 제거 시도)', 'DieCasting_XGB_20261109_23.joblib', 'TM/model_ml/DieCasting_XGB_20261109_23/DieCasting_XGB_20261109_23.joblib', DATE '2026-11-09', 0.4143, 0.8000, 0.1983, 0.3179),
    ('DieCasting_XGB_20261109_24', 'v3.3', '[XGBoost] 런 내 편차 중심 22개 (슬리브·용융온도 절대값 제외)', 'DieCasting_XGB_20261109_24.joblib', 'TM/model_ml/DieCasting_XGB_20261109_24/DieCasting_XGB_20261109_24.joblib', DATE '2026-11-09', 0.3842, 0.7013, 0.2231, 0.3386),
    ('DieCasting_XGB_20261109_25', 'v4.1', '[XGBoost] Streamlit 시제품: 규칙(압력<600) 뒤 2단계 모델, 원본14 + 런 내 편차10', NULL, NULL, DATE '2026-11-09', 0.4143, 0.8000, 0.1983, 0.3179),
    ('DieCasting_HGB_20261111_01', 'v5.1', '[HistGB] 첫 단일 모델: 상하 금형 평균·편차·냉각수·형체력·압력<600 7개', 'DieCasting_HGB_20261111_01.joblib', 'TM/model_ml/DieCasting_HGB_20261111_01/DieCasting_HGB_20261111_01.joblib', DATE '2026-11-11', 0.7270, 0.9537, 0.6375, 0.7642),
    ('DieCasting_GB_20261111_01', 'v5.2', '[GradientBoosting] 첫 단일 모델 7개 변수의 비교용 GradientBoosting', 'DieCasting_GB_20261111_01.joblib', 'TM/model_ml/DieCasting_GB_20261111_01/DieCasting_GB_20261111_01.joblib', DATE '2026-11-11', 0.6365, 0.7557, 0.6220, 0.6824),
    ('DieCasting_HGB_20261111_02', 'v9.1', '[HistGB] 금형 온도 표현: 센서 4개 대신 상하 평균 2개', 'DieCasting_HGB_20261111_02.joblib', 'TM/model_ml/DieCasting_HGB_20261111_02/DieCasting_HGB_20261111_02.joblib', DATE '2026-11-11', 0.8211, 0.9611, 0.6787, 0.7956),
    ('DieCasting_HGB_20261111_03', 'v9.2', '[HistGB] 금형 온도 표현: 상하 평균 + 금형 평균 + 상하 편차', 'DieCasting_HGB_20261111_03.joblib', 'TM/model_ml/DieCasting_HGB_20261111_03/DieCasting_HGB_20261111_03.joblib', DATE '2026-11-11', 0.8275, 0.9681, 0.6787, 0.7980),
    ('DieCasting_HGB_20261112_01', 'v10.1', '[HistGB] 최종 8개 + 금형 4센서 평균', 'DieCasting_HGB_20261112_01.joblib', 'TM/model_ml/DieCasting_HGB_20261112_01/DieCasting_HGB_20261112_01.joblib', DATE '2026-11-12', 0.8308, 0.9425, 0.7045, 0.8063),
    ('DieCasting_HGB_20261112_02', 'v10.2', '[HistGB] 최종 8개 + 금형 평균 + ''냉각수 낮음×금형 평균 낮음'' 조합 표시', 'DieCasting_HGB_20261112_02.joblib', 'TM/model_ml/DieCasting_HGB_20261112_02/DieCasting_HGB_20261112_02.joblib', DATE '2026-11-12', 0.8254, 0.9469, 0.7045, 0.8079),
    ('DieCasting_HGB_20261112_03', 'v11.1', '[HistGB] 변수 쌍 가설: 상금형 평균 × 하금형 평균 (2개 변수만)', 'DieCasting_HGB_20261112_03.joblib', 'TM/model_ml/DieCasting_HGB_20261112_03/DieCasting_HGB_20261112_03.joblib', DATE '2026-11-12', 0.4411, 0.8410, 0.4089, 0.5503),
    ('DieCasting_HGB_20261112_04', 'v11.2', '[HistGB] 변수 쌍 가설: 상금형 평균 × 하금형 평균 (2개 변수만) — 정상 조건 샷 전용', 'DieCasting_HGB_20261112_04.joblib', 'TM/model_ml/DieCasting_HGB_20261112_04/DieCasting_HGB_20261112_04.joblib', DATE '2026-11-12', 0.1825, 0.4737, 0.2231, 0.3034),
    ('DieCasting_HGB_20261112_05', 'v11.3', '[HistGB] 변수 쌍 가설: 상금형 센서 차 × 하금형 센서 차 (2개 변수만)', 'DieCasting_HGB_20261112_05.joblib', 'TM/model_ml/DieCasting_HGB_20261112_05/DieCasting_HGB_20261112_05.joblib', DATE '2026-11-12', 0.0613, 0.0386, 0.5498, 0.0721),
    ('DieCasting_HGB_20261112_06', 'v11.4', '[HistGB] 변수 쌍 가설: 상금형 센서 차 × 하금형 센서 차 (2개 변수만) — 정상 조건 샷 전용', 'DieCasting_HGB_20261112_06.joblib', 'TM/model_ml/DieCasting_HGB_20261112_06/DieCasting_HGB_20261112_06.joblib', DATE '2026-11-12', 0.0159, 0.0159, 0.6529, 0.0310),
    ('DieCasting_HGB_20261112_07', 'v11.5', '[HistGB] 변수 쌍 가설: 금형 평균 × 냉각수 온도 (2개 변수만)', 'DieCasting_HGB_20261112_07.joblib', 'TM/model_ml/DieCasting_HGB_20261112_07/DieCasting_HGB_20261112_07.joblib', DATE '2026-11-12', 0.5639, 0.8925, 0.4278, 0.5784),
    ('DieCasting_HGB_20261112_08', 'v11.6', '[HistGB] 변수 쌍 가설: 금형 평균 × 냉각수 온도 (2개 변수만) — 정상 조건 샷 전용', 'DieCasting_HGB_20261112_08.joblib', 'TM/model_ml/DieCasting_HGB_20261112_08/DieCasting_HGB_20261112_08.joblib', DATE '2026-11-12', 0.2555, 0.6075, 0.2686, 0.3725),
    ('DieCasting_HGB_20261112_09', 'v11.7', '[HistGB] 변수 쌍 가설: 금형 평균 × 설비 사이클 (2개 변수만)', 'DieCasting_HGB_20261112_09.joblib', 'TM/model_ml/DieCasting_HGB_20261112_09/DieCasting_HGB_20261112_09.joblib', DATE '2026-11-12', 0.5393, 0.8760, 0.3643, 0.5146),
    ('DieCasting_HGB_20261112_10', 'v11.8', '[HistGB] 변수 쌍 가설: 금형 평균 × 설비 사이클 (2개 변수만) — 정상 조건 샷 전용', 'DieCasting_HGB_20261112_10.joblib', 'TM/model_ml/DieCasting_HGB_20261112_10/DieCasting_HGB_20261112_10.joblib', DATE '2026-11-12', 0.2351, 0.6184, 0.1942, 0.2956),
    ('DieCasting_HGB_20261112_11', 'v11.9', '[HistGB] 변수 쌍 가설: 생산 순번 × 금형 평균 (2개 변수만)', 'DieCasting_HGB_20261112_11.joblib', 'TM/model_ml/DieCasting_HGB_20261112_11/DieCasting_HGB_20261112_11.joblib', DATE '2026-11-12', 0.4829, 0.8961, 0.3557, 0.5092),
    ('DieCasting_HGB_20261112_12', 'v11.10', '[HistGB] 변수 쌍 가설: 생산 순번 × 금형 평균 (2개 변수만) — 정상 조건 샷 전용', 'DieCasting_HGB_20261112_12.joblib', 'TM/model_ml/DieCasting_HGB_20261112_12/DieCasting_HGB_20261112_12.joblib', DATE '2026-11-12', 0.2138, 0.6623, 0.2107, 0.3197),
    ('DieCasting_XGB_20261114_01', 'v16.1', '[XGBoost] GridSearchCV 1위 설정 (최종 8개 변수)', 'DieCasting_XGB_20261114_01.joblib', 'TM/model_ml/DieCasting_XGB_20261114_01/DieCasting_XGB_20261114_01.joblib', DATE '2026-11-14', 0.8252, 0.9333, 0.6976, 0.7984),
    ('DieCasting_XGB_20261114_02', 'v16.2', '[XGBoost] GridSearchCV 2위 설정 (최종 8개 변수)', 'DieCasting_XGB_20261114_02.joblib', 'TM/model_ml/DieCasting_XGB_20261114_02/DieCasting_XGB_20261114_02.joblib', DATE '2026-11-14', 0.8297, 0.9378, 0.6993, 0.8012),
    ('DieCasting_XGB_20261114_03', 'v16.3', '[XGBoost] GridSearchCV 3위 설정 (최종 8개 변수)', 'DieCasting_XGB_20261114_03.joblib', 'TM/model_ml/DieCasting_XGB_20261114_03/DieCasting_XGB_20261114_03.joblib', DATE '2026-11-14', 0.8267, 0.9394, 0.6924, 0.7972),
    ('DieCasting_XGB_20261114_04', 'v16.4', '[XGBoost] GridSearchCV 4위 설정 (최종 8개 변수)', 'DieCasting_XGB_20261114_04.joblib', 'TM/model_ml/DieCasting_XGB_20261114_04/DieCasting_XGB_20261114_04.joblib', DATE '2026-11-14', 0.8267, 0.9692, 0.6478, 0.7765),
    ('DieCasting_CatB_20261114_01', 'v16.5', '[CatBoost] GridSearchCV 5위 설정 (최종 8개 변수)', 'DieCasting_CatB_20261114_01.joblib', 'TM/model_ml/DieCasting_CatB_20261114_01/DieCasting_CatB_20261114_01.joblib', DATE '2026-11-14', 0.8430, 0.9706, 0.6804, 0.8000),
    ('DieCasting_CatB_20261114_02', 'v16.6', '[CatBoost] GridSearchCV 6위 설정 (최종 8개 변수)', 'DieCasting_CatB_20261114_02.joblib', 'TM/model_ml/DieCasting_CatB_20261114_02/DieCasting_CatB_20261114_02.joblib', DATE '2026-11-14', 0.8288, 0.9586, 0.6770, 0.7936),
    ('DieCasting_XGB_20261114_05', 'v16.7', '[XGBoost] GridSearchCV 7위 설정 (최종 8개 변수)', 'DieCasting_XGB_20261114_05.joblib', 'TM/model_ml/DieCasting_XGB_20261114_05/DieCasting_XGB_20261114_05.joblib', DATE '2026-11-14', 0.8167, 0.9406, 0.6804, 0.7896),
    ('DieCasting_LGBM_20261114_01', 'v16.8', '[LightGBM] GridSearchCV 8위 설정 (최종 8개 변수)', 'DieCasting_LGBM_20261114_01.joblib', 'TM/model_ml/DieCasting_LGBM_20261114_01/DieCasting_LGBM_20261114_01.joblib', DATE '2026-11-14', 0.8006, 0.9142, 0.6770, 0.7779),
    ('DieCasting_XGB_20261114_06', 'v16.9', '[XGBoost] GridSearchCV 9위 설정 (최종 8개 변수)', 'DieCasting_XGB_20261114_06.joblib', 'TM/model_ml/DieCasting_XGB_20261114_06/DieCasting_XGB_20261114_06.joblib', DATE '2026-11-14', 0.8285, 0.9471, 0.6770, 0.7896),
    ('DieCasting_XGB_20261114_07', 'v16.10', '[XGBoost] GridSearchCV 10위 설정 (최종 8개 변수)', 'DieCasting_XGB_20261114_07.joblib', 'TM/model_ml/DieCasting_XGB_20261114_07/DieCasting_XGB_20261114_07.joblib', DATE '2026-11-14', 0.8283, 0.9693, 0.6512, 0.7790),
    ('DieCasting_HGB_20261114_01', 'v16.11', '[HistGB] GridSearchCV 13위 설정 (최종 8개 변수)', 'DieCasting_HGB_20261114_01.joblib', 'TM/model_ml/DieCasting_HGB_20261114_01/DieCasting_HGB_20261114_01.joblib', DATE '2026-11-14', 0.8185, 0.9559, 0.6701, 0.7879),
    ('DieCasting_XGB_20261114_08', 'v16.12', '[XGBoost] 튜닝 전 XGBoost (깊이 4, 트리 300) — 튜닝 효과 비교 기준', 'DieCasting_XGB_20261114_08.joblib', 'TM/model_ml/DieCasting_XGB_20261114_08/DieCasting_XGB_20261114_08.joblib', DATE '2026-11-14', 0.8405, 0.9973, 0.6392, 0.7791),
    ('DieCasting_XGB_20261114_10', 'v17.1', '[XGBoost] 최종 모델 v1.0 검증용: 앞 80% 학습, Test로 성능 확인한 모델', 'DieCasting_XGB_20261114_10.pkl', 'TM/model_ml/DieCasting_XGB_20261114_10/DieCasting_XGB_20261114_10.pkl', DATE '2026-11-14', 0.8297, 0.9378, 0.6993, 0.8012),
    ('DieCasting_XGB_20261114_09', 'v17.2', '[XGBoost] 최종 모델 v1.0 배포용: 같은 설정으로 데이터 100% 학습 (Test도 학습에 포함)', 'DieCasting_XGB_20261114_09.pkl', 'TM/model_ml/DieCasting_XGB_20261114_09/DieCasting_XGB_20261114_09.pkl', DATE '2026-11-14', 0.8297, 0.9378, 0.6993, 0.8012);

BEGIN;

-- 이전에 v1 로 등록한 배포 모델 정리 (지표는 함께 지워짐, 판정 결과가 이 버전을 쓰면 여기서 멈춤)
DELETE FROM ai.model_registry WHERE model_name = 'DieCasting_XGB_20261114_09' AND version = 'v1';

-- 1. 레지스트리 (배포는 _09 하나 — 트리거가 같은 공정 기존 배포를 해제)
INSERT INTO ai.model_registry (model_registry_idx, model_name, version, process_code, description, file_name, file_path, deployed, created_at)
SELECT (SELECT COALESCE(max(model_registry_idx), 0) FROM ai.model_registry) + row_number() OVER (ORDER BY m.trained, m.model_name),
       m.model_name, m.version, 'CAST-QC1', m.description, m.file_name, m.file_path,
       m.model_name = 'DieCasting_XGB_20261114_09',
       (m.trained::timestamp AT TIME ZONE 'Asia/Seoul')
FROM qc1_models m
ON CONFLICT (model_name, version) DO UPDATE
   SET process_code = EXCLUDED.process_code, description = EXCLUDED.description,
       file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path, deployed = EXCLUDED.deployed;

-- 2. 성과지표
DELETE FROM ai.model_metric_cast_qc1 t USING qc1_models m WHERE (t.model_name, t.version) = (m.model_name, m.version);
INSERT INTO ai.model_metric_cast_qc1 (model_name, version, pr_auc_score, recall_score, precision_score, f1_score)
SELECT model_name, version, pr_auc, rec, prec, f1 FROM qc1_models;

COMMIT;
DROP TABLE IF EXISTS qc1_models;

-- 확인: CAST-QC1 56행 · 배포 1행 · 지표 56행
SELECT count(*) AS 모델수, count(*) FILTER (WHERE deployed) AS 배포수,
       string_agg(model_name || ' / ' || version, ', ') FILTER (WHERE deployed) AS 배포모델,
       count(*) FILTER (WHERE file_name IS NULL) AS 파일없음
FROM ai.model_registry WHERE process_code = 'CAST-QC1';
SELECT count(*) AS 지표수 FROM ai.model_metric_cast_qc1;
