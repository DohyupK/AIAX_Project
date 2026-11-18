# TM/model_ml — DieCasting 모델 아티팩트

주조 PassOrFail 실험·배포 모델입니다. **파일명 = 폴더명** (확장자만 다름).

## 명명 규칙

```text
DieCasting_{Algo}_{YYYYMMDD}_{NN}
예) DieCasting_XGB_20261114_09
```

- `Algo`: XGB / LGBM / CatB / HGB / GB / RF
- `YYYYMMDD`: 학습·배치 날짜
- `NN`: 같은 Algo+날짜 안 순번 (01부터)

운영(배포) 모델: `DieCasting_XGB_20261114_09` (`.pkl`). 성능 근거: `…_10`.
실험 상세·약어·원본 C번호: 아래 대응표 + [top10_test_results.csv](top10_test_results.csv).

파일/폴더 이름만 바꿨으므로 **모델 가중치·성능은 동일**합니다.

## 구이름 → 새이름

| 새 이름 | 구 이름(요약) | 날짜 | 비고 |
|---------|---------------|------|------|
| `DieCasting_XGB_20261107_01` | `TM/xgb_model/model_xgb2_missing_test` | 2026-11-07 | 이전 이식(피처17) |
| `DieCasting_RF_20261109_01` | `261109_RF_01-01_importance72` | 2026-11-09 | 01 importance72 RF |
| `DieCasting_XGB_20261109_01` | `261109_XGB_01-02_importance72` | 2026-11-09 | 01 importance72 XGB |
| `DieCasting_XGB_20261109_02` | `261109_XGB_01-03_all72-p600` | 2026-11-09 | 01 all72-p600 |
| `DieCasting_XGB_20261109_03` | `261109_XGB_01-04_M1-all` | 2026-11-09 | 01 M1-all |
| `DieCasting_XGB_20261109_04` | `261109_XGB_01-05_M1-all-p600` | 2026-11-09 | 01 M1-all-p600 |
| `DieCasting_XGB_20261109_05` | `261109_XGB_01-06_M2-stat` | 2026-11-09 | 01 M2-stat |
| `DieCasting_XGB_20261109_06` | `261109_XGB_01-07_M2-stat-p600` | 2026-11-09 | 01 M2-stat-p600 |
| `DieCasting_XGB_20261109_07` | `261109_XGB_01-08_M3-mi15` | 2026-11-09 | 01 M3-mi15 |
| `DieCasting_XGB_20261109_08` | `261109_XGB_01-09_M3-mi15-p600` | 2026-11-09 | 01 M3-mi15-p600 |
| `DieCasting_XGB_20261109_09` | `261109_XGB_01-10_M4-imp15` | 2026-11-09 | 01 M4-imp15 |
| `DieCasting_XGB_20261109_10` | `261109_XGB_01-11_M4-imp15-p600` | 2026-11-09 | 01 M4-imp15-p600 |
| `DieCasting_XGB_20261109_11` | `261109_XGB_01-12_M5` | 2026-11-09 | 01 M5 |
| `DieCasting_XGB_20261109_12` | `261109_XGB_01-13_M5-p600` | 2026-11-09 | 01 M5-p600 |
| `DieCasting_XGB_20261109_13` | `261109_XGB_01-14_M5b-biscuit` | 2026-11-09 | 01 M5b-biscuit |
| `DieCasting_XGB_20261109_14` | `261109_XGB_01-15_M5b-biscuit-p600` | 2026-11-09 | 01 M5b-biscuit-p600 |
| `DieCasting_XGB_20261109_15` | `261109_XGB_01-16_M5-random-p600` | 2026-11-09 | 01 M5-random-p600 |
| `DieCasting_XGB_20261109_16` | `261109_XGB_02-01_M5v2-sleeve` | 2026-11-09 | 02 sleeve |
| `DieCasting_XGB_20261109_17` | `261109_XGB_02-02_M5v2-sleeve-p600` | 2026-11-09 | 02 sleeve-p600 |
| `DieCasting_XGB_20261109_18` | `261109_XGB_02-03_M5v2-nosleeve` | 2026-11-09 | 02 nosleeve |
| `DieCasting_XGB_20261109_19` | `261109_XGB_02-04_M5v2-nosleeve-p600` | 2026-11-09 | 02 nosleeve-p600 |
| `DieCasting_XGB_20261109_20` | `261109_XGB_02-05_M5v2-biscuit` | 2026-11-09 | 02 biscuit |
| `DieCasting_XGB_20261109_21` | `261109_XGB_02-06_M5v2-biscuit-p600` | 2026-11-09 | 02 biscuit-p600 |
| `DieCasting_XGB_20261109_22` | `261109_XGB_03-01_abs-p600` | 2026-11-09 | 03 abs-p600 |
| `DieCasting_XGB_20261109_23` | `261109_XGB_03-02_abs-rundev-p600` | 2026-11-09 | 03 abs-rundev-p600 |
| `DieCasting_XGB_20261109_24` | `261109_XGB_03-03_rundev-p600` | 2026-11-09 | 03 rundev-p600 |
| `DieCasting_HGB_20261111_01` | `261111_HGB_04-01_7vars` | 2026-11-11 | 04 7vars HGB |
| `DieCasting_GB_20261111_01` | `261111_GB_04-02_7vars-ref` | 2026-11-11 | 04 7vars GB ref |
| `DieCasting_HGB_20261111_02` | `261111_HGB_05-02_tb-mean` | 2026-11-11 | 05 tb-mean |
| `DieCasting_HGB_20261111_03` | `261111_HGB_05-03_tb-mean-molddev` | 2026-11-11 | 05 tb-mean-molddev |
| `DieCasting_HGB_20261112_01` | `261112_HGB_06-02_8vars-mold` | 2026-11-12 | 06 8vars-mold |
| `DieCasting_HGB_20261112_02` | `261112_HGB_06-03_8vars-mold-flag` | 2026-11-12 | 06 8vars-mold-flag |
| `DieCasting_HGB_20261112_03` | `261112_HGB_07-03_top-x-bottom` | 2026-11-12 | 07 top-x-bottom |
| `DieCasting_HGB_20261112_04` | `261112_HGB_07-03_top-x-bottom-norm` | 2026-11-12 | 07 top-x-bottom-norm |
| `DieCasting_HGB_20261112_05` | `261112_HGB_07-04_topdev-x-botdev` | 2026-11-12 | 07 topdev-x-botdev |
| `DieCasting_HGB_20261112_06` | `261112_HGB_07-04_topdev-x-botdev-norm` | 2026-11-12 | 07 topdev-x-botdev-norm |
| `DieCasting_HGB_20261112_07` | `261112_HGB_07-05_mold-x-cool` | 2026-11-12 | 07 mold-x-cool |
| `DieCasting_HGB_20261112_08` | `261112_HGB_07-05_mold-x-cool-norm` | 2026-11-12 | 07 mold-x-cool-norm |
| `DieCasting_HGB_20261112_09` | `261112_HGB_07-09_mold-x-cycle` | 2026-11-12 | 07 mold-x-cycle |
| `DieCasting_HGB_20261112_10` | `261112_HGB_07-09_mold-x-cycle-norm` | 2026-11-12 | 07 mold-x-cycle-norm |
| `DieCasting_HGB_20261112_11` | `261112_HGB_07-10_count-x-mold` | 2026-11-12 | 07 count-x-mold |
| `DieCasting_HGB_20261112_12` | `261112_HGB_07-10_count-x-mold-norm` | 2026-11-12 | 07 count-x-mold-norm |
| `DieCasting_XGB_20261114_01` | `261114_XGB_08-01_rank1` | 2026-11-14 | 08 rank1 |
| `DieCasting_XGB_20261114_02` | `261114_XGB_08-02_rank2` | 2026-11-14 | 08 rank2 |
| `DieCasting_XGB_20261114_03` | `261114_XGB_08-03_rank3` | 2026-11-14 | 08 rank3 |
| `DieCasting_XGB_20261114_04` | `261114_XGB_08-04_rank4` | 2026-11-14 | 08 rank4 |
| `DieCasting_CatB_20261114_01` | `261114_CatB_08-05_rank5` | 2026-11-14 | 08 rank5 CatB |
| `DieCasting_CatB_20261114_02` | `261114_CatB_08-06_rank6` | 2026-11-14 | 08 rank6 CatB |
| `DieCasting_XGB_20261114_05` | `261114_XGB_08-07_rank7` | 2026-11-14 | 08 rank7 |
| `DieCasting_LGBM_20261114_01` | `261114_LGBM_08-08_rank8` | 2026-11-14 | 08 rank8 LGBM |
| `DieCasting_XGB_20261114_06` | `261114_XGB_08-09_rank9` | 2026-11-14 | 08 rank9 |
| `DieCasting_XGB_20261114_07` | `261114_XGB_08-10_rank10` | 2026-11-14 | 08 rank10 |
| `DieCasting_HGB_20261114_01` | `261114_HGB_08-11_rank13` | 2026-11-14 | 08 rank13 HGB |
| `DieCasting_XGB_20261114_08` | `261114_XGB_08-12_untuned` | 2026-11-14 | 08 untuned |
| `DieCasting_XGB_20261114_09` | `20261114_XGBoost_casting_v1.0.pkl` | 2026-11-14 | 배포용 최종(전체 100%) |
| `DieCasting_XGB_20261114_10` | `20261114_XGBoost_casting_v1.0_validated.pkl` | 2026-11-14 | 성능 근거(앞 80%) |

## 경로

```text
TM/model_ml/
  DieCasting_*/          # 폴더 = 모델명
    DieCasting_*.joblib | .pkl | .json
  README.md
  top10_test_results.csv
```

이전 경로 `models_list/`, `final_model/`, `TM/xgb_model/` 는 2026-11-17 이 구조로 통합했습니다.
