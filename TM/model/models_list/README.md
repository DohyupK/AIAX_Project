# models_list — 주조 불량(PassOrFail) 실험 모델 모음

실험·비교용 모델 53개입니다. **운영(배포) 모델은 여기가 아니라** [`../final_model/`](../final_model/) 에 있습니다.  
여기 있는 모델은 **전부 일부 데이터(60% 또는 80%)로 학습**했습니다. 전체 100% 학습 모델은 `final_model/…_v1.0.pkl` 하나뿐입니다.

## 파일명 규칙

```
{YYMMDD}_{알고리즘}_{실험-순번}_{핵심 설명}.joblib
예) 261109_XGB_01-05_M1-all-p600.joblib
```

- `YYMMDD` — 학습(아이디어) 날짜
- `실험-순번` — 이 폴더의 실험 번호(01~08)와 원본 노트북 안의 저장 순번
- 학습 범위·하이퍼파라미터·점수는 파일명에 넣지 않고 이 문서에 적습니다.

## 실험 번호 (2026-11-17 연속 번호로 정리, 폴더·파일명의 C 접두어 제거)

원본 프로젝트(`진짜주조eda`)의 실험 번호와 다릅니다. 원본 코드·노트북을 찾을 때는 **원본 번호**를 보세요.

| 폴더 | 원본 번호 | 모델 수 | 학습 범위 |
|------|-----------|---------|-----------|
| `01_feature-selection` | C01 | 16 | Train 60% (`p600` 은 그중 압력 ≥ 600), 01-16 만 정상압력 샷 무작위 80% |
| `02_m5-revision` | C02 | 6 | Train 60% |
| `03_run-deviation` | C03 | 3 | Train 60% 중 압력 ≥ 600 |
| `04_first-single-model` | C05 | 2 | Train 60% (런 순서 앞 44,166샷) |
| `05_mold-temp-representation` | C09 | 2 | Train+Val 80% (앞 58,888샷) |
| `06_final8-plus-mold` | C10 | 2 | Train+Val 80% |
| `07_pair-hypothesis` | C11 | 10 | Train 60% (런 순서 앞 44,166샷), `norm` 은 그중 정상 조건 |
| `08_top10-test-compare` | C16 | 12 | Train+Val 80% |

- 원본 C04(Streamlit 화면 시제품용 모델, 1개)는 2026-11-17 이 폴더에서 삭제했습니다. 원본 프로젝트에는 남아 있습니다.
- 전체 73,611샷을 **런 순서대로** 정렬해 앞에서부터 나눈 것으로 보입니다 (Train 60% / Val 20% / Test 20% 추정).

## 실험별 내용

### 01 변수 세트 고르기 (16개)
원본에 파생변수 55개(이동평균, 직전값, 샷 간격, 금형 평균·편차 등)를 붙인 72개에서, 고르는 방법 5가지로 세트를 만들어 비교. XGBoost, 시간순 분할 평가.

| 세트 | 변수 수 | PR-AUC | 정상 압력 샷 PR-AUC |
|------|---------|--------|---------------------|
| M1 전체 | 72 | 0.834 | 0.434 |
| M2 통계 기준 | 40 | 0.816 | 0.404 |
| M3 상호정보량 상위 15 | 15 | 0.818 | 0.358 |
| M4 모델 중요도 상위 15 | 15 | 0.844 | 0.405 |
| M5 공정 이론 + 통계 | 25 | 0.830 | 0.377 |
| M5b M5 + 비스켓 | 26 | 0.851 | 0.477 |

결론: 파생변수를 많이 넣어도 크게 좋아지지 않음. 16개 중 중요도 계산용 3개(01-01~03), 무작위 분할 비교용 1개(01-16) 포함.

### 02 M5 개정판 (6개)
슬리브 온도 포함/제외, 비스켓 추가를 비교. 세트마다 전체 샷·정상 압력 샷 두 가지.  
결과: 슬리브 포함 0.820, 제외 0.801, 비스켓 추가 0.832.  
결론: 이때는 슬리브 온도가 도움이 되는 것처럼 보였으나, 이후 다른 기간에서 기여가 없고 오경보만 늘려 최종에서 제외.

### 03 런 내 편차 (3개)
각 변수를 "런 시작부터 직전 샷까지의 중앙값에서 벗어난 정도"로 바꾼 파생변수 시험. 정상 조건 샷, Test 기간 기준.  
결과: 절대값만 0.367 → 절대값 + 런 내 편차 0.414 → 편차 중심 0.384.  
결론: 정상 조건 샷에서 효과는 있으나 계산이 복잡하고 실시간 운영이 어려워 최종 모델에 넣지 않음.

### 04 첫 단일 모델 (2개, 원본 C05)
금형 평균, 금형 편차 등 7개 변수로 HistGB.  
결과: Val PR-AUC 0.730 (비교용 GradientBoosting 0.693). 이후 실험의 출발점.

### 05 금형 온도 표현 (2개, 원본 C09)
결과: 센서 4개 그대로 0.785 / 상·하 평균 0.781 / 평균 + 편차 0.786.  
결론: 차이가 0.001~0.004 로 거의 없어 단순한 "센서 그대로" 선택. 폴더에는 평균·편차를 쓴 2개만 있음.

### 06 최종 8개 + 금형 평균 (2개, 원본 C10)
결과: 지금 8개 0.785 / + 금형 평균 0.791 / + 금형 평균 + 조합 표시 0.788.  
결론: 차이가 작아 지금 8개 유지.

### 07 변수쌍 모델 (10개, 원본 C11)
"두 변수를 같이 보면 불량이 더 잘 보인다"는 가설 10개를 하나씩 확인. 이 폴더에는 파생변수가 들어간 5개 쌍만 있고, 쌍마다 모든 샷·정상 조건 샷 모델이 하나씩.  
생산 순번 × 금형 평균 / 상금형 평균 × 하금형 평균 / 상·하 금형 편차 / 금형 평균 × 냉각수 / 금형 평균 × 사이클.  
결론: 금형 × 냉각수 조합 효과가 가장 커서, 냉각수 온도를 최종 변수에 넣는 근거가 됨.

### 08 상위 10 Test 비교 (12개, 원본 C16)
CV 상위 모델들을 Test 기간으로 비교. 자세한 값: [top10_test_results.csv](08_top10-test-compare/top10_test_results.csv)

| 파일 | 하이퍼파라미터 | CV PR-AUC | Test PR-AUC |
|------|----------------|-----------|-------------|
| `261114_XGB_08-01_rank1` | lr 0.02, depth 8, mcw 1, λ 1, spw 3, sub 0.7 | 0.8069 | 0.8252 |
| `261114_XGB_08-02_rank2` | lr 0.02, depth 6, mcw 1, λ 1, spw 3, sub 0.7 | 0.8069 | 0.8297 |
| `261114_XGB_08-03_rank3` | lr 0.02, depth 6, mcw 1, λ 10, spw 3, sub 0.7 | 0.8053 | 0.8267 |
| `261114_XGB_08-04_rank4` | lr 0.02, depth 8, mcw 1, λ 10, spw 3, sub 0.7 | 0.8051 | 0.8267 |
| `261114_CatB_08-05_rank5` | depth 8, trees 500, l2 1, lr 0.03 | 0.8047 | 0.8430 |
| `261114_CatB_08-06_rank6` | depth 8, trees 1000, l2 1, lr 0.03 | 0.8046 | 0.8288 |
| `261114_XGB_08-07_rank7` | lr 0.05, depth 8, mcw 1, λ 10, spw 3, sub 0.7 | 0.8024 | 0.8167 |
| `261114_LGBM_08-08_rank8` | lr 0.05, depth 8, mcs 20, leaves 63, λ 0, sub 0.85 | 0.8021 | 0.8006 |
| `261114_XGB_08-09_rank9` | lr 0.02, depth 6, mcw 1, λ 10, spw 1, sub 0.7 | 0.8020 | 0.8285 |
| `261114_XGB_08-10_rank10` | lr 0.02, depth 6, mcw 10, λ 10, spw 3, sub 0.7 | 0.8013 | 0.8283 |
| `261114_HGB_08-11_rank13` | l2 1, lr 0.1, depth 6, trees 300, msl 20 | 0.8011 | 0.8185 |
| `261114_XGB_08-12_untuned` | depth 4, trees 300, lr 0.05, λ 1.0 | 0.7757 | 0.8405 |

## 약어

| 약어 | 뜻 |
|------|----|
| `XGB` / `LGBM` / `CatB` | XGBoost / LightGBM / CatBoost |
| `HGB` / `GB` / `RF` | sklearn HistGradientBoosting / GradientBoosting / RandomForest |
| (없음) | 전체 샷으로 학습 |
| `p600` | 사출압력(`injection_pressure`) ≥ 600 인 샷만 학습 |
| `norm` | 정상 조건 샷만 학습 (07). 조건: `injection_pressure >= 600` **그리고** `mechanical_strength > 0` (원본 `models_all/_build/build_C.py`, `pair_hypothesis_test.py`). 현재 데이터에서는 압력 ≥ 600 샷 71,776개 중 형체력 0 샷이 0개라 `p600` 과 **같은 샷 집합**. 단 정의가 달라 새 데이터에서는 달라질 수 있어 이름을 구분해 둠 |
| `importance72` / `all72` | 변수 72개 전체 (변수 중요도 산출용 / 정상압력 전용) |
| `M1` ~ `M5`, `M5b` | 01 변수세트 (위 01 표) |
| `M5-random` | M5, 시간순이 아닌 **무작위 80% 분할** (낙관 편향 비교용) |
| `M5v2-sleeve` / `-nosleeve` / `-biscuit` | 02: sleeve 포함 / sleeve 제외 / biscuit 추가 |
| `abs` / `abs-rundev` / `rundev` | 03: 절대값만 / 절대값 + 런 내 편차 / 편차 중심(sleeve·mold 절대값 제외) |
| `7vars` / `7vars-ref` | 04: 첫 단일모델 7변수 HistGB / 같은 7변수 GradientBoosting 참고 비교 |
| `tb-mean` / `tb-mean-molddev` | 05: 상·하 금형 평균 / + 금형 평균 + 편차 |
| `8vars-mold` / `8vars-mold-flag` | 06: 8개 + 금형 평균 / + 조합 표시(냉각수 ≤ 학습 5% 이면서 금형 평균이 학습 5~25%) |
| `top-x-bottom` 등 | 07 변수쌍: 상금형평균×하금형평균, 상·하 편차, 금형평균×냉각수, 금형평균×사이클, 생산순번(`count`)×금형평균 |
| `rankN` | 08 CV 순위 (Test 순위 아님) |
| `untuned` | 튜닝 전 XGBoost 기준 모델 |

하이퍼파라미터 약어: `mcw` min_child_weight, `spw` scale_pos_weight, `sub` subsample, `mcs` min_child_samples, `msl` min_samples_leaf, `λ`/`l2` L2 정규화.

## 원본 파일명 대응표

원본 프로젝트(`진짜주조eda`) 코드에는 이 파일명을 불러오거나(`joblib.load`) 저장하는(`joblib.dump`) 코드가 없음을 확인했습니다 (2026-11-17). 원본 실험은 `outputs/model/…` 아래 `.pkl` 로 저장했고, 이 폴더의 `.joblib` 은 원본의 `models_all/_build/` 스크립트(`zoo.py` 저장 → `rename_english.py` 이름 변경)로 만든 사본 중 일부입니다. 따라서 이름 변경으로 깨지는 코드는 없습니다.  
원본에서 `_build/build_*.py` 를 다시 돌려 사본을 새로 만들면 원본 이름·원본 번호로 나오므로, 새로 받은 파일은 이 표 기준으로 다시 이름을 맞춰 주세요.

| 새 이름 | 원본 이름 |
|---------|-----------|
| 261109_RF_01-01_importance72 | 20261109_RandomForest_casting_C01_importance-all72vars |
| 261109_XGB_01-02_importance72 | 20261109_XGBoost_casting_C01_importance-all72vars |
| 261109_XGB_01-03_all72-p600 | 20261109_XGBoost_casting_C01_normalpressure-only-all72vars |
| 261109_XGB_01-04_M1-all | 20261109_XGBoost_casting_C01_M1-all-allshots |
| 261109_XGB_01-05_M1-all-p600 | 20261109_XGBoost_casting_C01_M1-all-normalpressure |
| 261109_XGB_01-06_M2-stat | 20261109_XGBoost_casting_C01_M2-stat-delta015-allshots |
| 261109_XGB_01-07_M2-stat-p600 | 20261109_XGBoost_casting_C01_M2-stat-delta015-normalpressure |
| 261109_XGB_01-08_M3-mi15 | 20261109_XGBoost_casting_C01_M3-mi-top15-allshots |
| 261109_XGB_01-09_M3-mi15-p600 | 20261109_XGBoost_casting_C01_M3-mi-top15-normalpressure |
| 261109_XGB_01-10_M4-imp15 | 20261109_XGBoost_casting_C01_M4-importance-top15-allshots |
| 261109_XGB_01-11_M4-imp15-p600 | 20261109_XGBoost_casting_C01_M4-importance-top15-normalpressure |
| 261109_XGB_01-12_M5 | 20261109_XGBoost_casting_C01_M5-combined-allshots |
| 261109_XGB_01-13_M5-p600 | 20261109_XGBoost_casting_C01_M5-combined-normalpressure |
| 261109_XGB_01-14_M5b-biscuit | 20261109_XGBoost_casting_C01_M5b-combined-biscuit-leak-suspect-allshots |
| 261109_XGB_01-15_M5b-biscuit-p600 | 20261109_XGBoost_casting_C01_M5b-combined-biscuit-leak-suspect-normalpressure |
| 261109_XGB_01-16_M5-random-p600 | 20261109_XGBoost_casting_C01_M5-combined-random-split-normalpressure |
| 261109_XGB_02-01_M5v2-sleeve | 20261109_XGBoost_casting_C02_M5v2-with-sleeve-allshots |
| 261109_XGB_02-02_M5v2-sleeve-p600 | 20261109_XGBoost_casting_C02_M5v2-with-sleeve-normalpressure |
| 261109_XGB_02-03_M5v2-nosleeve | 20261109_XGBoost_casting_C02_M5v2-no-sleeve-allshots |
| 261109_XGB_02-04_M5v2-nosleeve-p600 | 20261109_XGBoost_casting_C02_M5v2-no-sleeve-normalpressure |
| 261109_XGB_02-05_M5v2-biscuit | 20261109_XGBoost_casting_C02_M5v2-biscuit-allshots |
| 261109_XGB_02-06_M5v2-biscuit-p600 | 20261109_XGBoost_casting_C02_M5v2-biscuit-normalpressure |
| 261109_XGB_03-01_abs-p600 | 20261109_XGBoost_casting_C03_absolute-only |
| 261109_XGB_03-02_abs-rundev-p600 | 20261109_XGBoost_casting_C03_absolute-plus-run-deviation |
| 261109_XGB_03-03_rundev-p600 | 20261109_XGBoost_casting_C03_deviation-centered-no-sleeve-mold-abs |
| 261111_HGB_04-01_7vars | 20261111_HistGB_casting_C05_first-single-7vars |
| 261111_GB_04-02_7vars-ref | 20261111_GradientBoosting_casting_C05_first-single-7vars-reference |
| 261111_HGB_05-02_tb-mean | 20261111_HistGB_casting_C09_top-bottom-mean |
| 261111_HGB_05-03_tb-mean-molddev | 20261111_HistGB_casting_C09_top-bottom-mean-plus-mold-mean-dev |
| 261112_HGB_06-02_8vars-mold | 20261112_HistGB_casting_C10_8vars-plus-mold-mean |
| 261112_HGB_06-03_8vars-mold-flag | 20261112_HistGB_casting_C10_8vars-plus-mold-mean-combo-flag |
| 261112_HGB_07-03_top-x-bottom | 20261112_HistGB_casting_C11_pair3-3-top-mean-x-bottom-mean-allshots |
| 261112_HGB_07-03_top-x-bottom-norm | 20261112_HistGB_casting_C11_pair3-3-top-mean-x-bottom-mean-normal |
| 261112_HGB_07-04_topdev-x-botdev | 20261112_HistGB_casting_C11_pair4-3-top-dev-x-bottom-dev-allshots |
| 261112_HGB_07-04_topdev-x-botdev-norm | 20261112_HistGB_casting_C11_pair4-3-top-dev-x-bottom-dev-normal |
| 261112_HGB_07-05_mold-x-cool | 20261112_HistGB_casting_C11_pair5-3-mold-mean-x-coolant-allshots |
| 261112_HGB_07-05_mold-x-cool-norm | 20261112_HistGB_casting_C11_pair5-3-mold-mean-x-coolant-normal |
| 261112_HGB_07-09_mold-x-cycle | 20261112_HistGB_casting_C11_pair9-3-mold-mean-x-cycle-allshots |
| 261112_HGB_07-09_mold-x-cycle-norm | 20261112_HistGB_casting_C11_pair9-3-mold-mean-x-cycle-normal |
| 261112_HGB_07-10_count-x-mold | 20261112_HistGB_casting_C11_pair10-3-count-x-mold-mean-allshots |
| 261112_HGB_07-10_count-x-mold-norm | 20261112_HistGB_casting_C11_pair10-3-count-x-mold-mean-normal |
| 261114_XGB_08-01_rank1 | 20261114_XGBoost_casting_C16_top10-rank01-lr0.02-depth8-mcw1-lambda1-spw3-sub0.7 |
| 261114_XGB_08-02_rank2 | 20261114_XGBoost_casting_C16_top10-rank02-lr0.02-depth6-mcw1-lambda1-spw3-sub0.7 |
| 261114_XGB_08-03_rank3 | 20261114_XGBoost_casting_C16_top10-rank03-lr0.02-depth6-mcw1-lambda10-spw3-sub0.7 |
| 261114_XGB_08-04_rank4 | 20261114_XGBoost_casting_C16_top10-rank04-lr0.02-depth8-mcw1-lambda10-spw3-sub0.7 |
| 261114_CatB_08-05_rank5 | 20261114_CatBoost_casting_C16_top10-rank05-depth8-trees500-l2-1-lr0.03 |
| 261114_CatB_08-06_rank6 | 20261114_CatBoost_casting_C16_top10-rank06-depth8-trees1000-l2-1-lr0.03 |
| 261114_XGB_08-07_rank7 | 20261114_XGBoost_casting_C16_top10-rank07-lr0.05-depth8-mcw1-lambda10-spw3-sub0.7 |
| 261114_LGBM_08-08_rank8 | 20261114_LightGBM_casting_C16_top10-rank08-lr0.05-depth8-mcs20-leaves63-lambda0-sub0.85 |
| 261114_XGB_08-09_rank9 | 20261114_XGBoost_casting_C16_top10-rank09-lr0.02-depth6-mcw1-lambda10-spw1-sub0.7 |
| 261114_XGB_08-10_rank10 | 20261114_XGBoost_casting_C16_top10-rank10-lr0.02-depth6-mcw10-lambda10-spw3-sub0.7 |
| 261114_HGB_08-11_rank13 | 20261114_HistGB_casting_C16_top10-rank13-l2-1-lr0.1-depth6-trees300-msl20 |
| 261114_XGB_08-12_untuned | 20261114_XGBoost_casting_C16_top10-ref-untuned-depth4-trees300-lr0.05-lambda1.0 |

모든 파일 확장자는 `.joblib` 입니다.
