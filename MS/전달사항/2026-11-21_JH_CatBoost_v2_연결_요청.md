# 2026-11-21 품질 1차 검사 CatBoost v2.0 연결 — JH 요청

<!-- 2026-11-21 MS -->
TM 최종 모델 v2.0(CatBoost)을 저장소와 등록 SQL에 넣었습니다. **아직 배포하지 않았고**, 지금 서버 코드로는 배포하면 오류가 납니다. 서버 연결을 부탁드립니다.

## 한눈에

| 항목 | 내용 |
|---|---|
| 모델 | `TM/model_ml/DieCasting_CatB_20261115_03/DieCasting_CatB_20261115_03.pkl` (구 이름 `DieCasting_CatB_v2.0_deploy.pkl`) |
| 입력 정의 | 같은 폴더 `DieCasting_CatB_20261115_03_INPUT.md` (TM 「입력변수_정의.md」) |
| 등록 | `MS/db/init/22_품질1차_모델등록.sql` — `v18.1`, 배포 안 함. 지표 PR-AUC 0.8557 · Precision 0.9575 · Recall 0.6976 · F1 0.8072 |
| 판정 기준값 | 0.5552 (pkl `threshold`) |

## 지금 배포하면 막히는 곳

| # | 위치 | 이유 |
|---|---|---|
| 1 | `JH/api/casting/model.py` `_load` | 입력 8개·첫 칸 `pressure_low` 인 모델만 통과. v2는 입력 12개라 「모델 입력 형식이 다릅니다」 오류 |
| 2 | `JH/api/casting/model.py` `_row` / `scores` | v2는 파생 4개 계산 + 결측 중앙값 채움 + float32 입력이 필요 (아래) |
| 3 | `JH/api/pyproject.toml` | `catboost` 없음 → pkl 불러오기 실패 |

## v2 입력 만들기 (상세는 `_INPUT.md`)

- 입력 12개 순서: `top_temp1, top_temp2, bottom_temp1, bottom_temp2, injection_pressure, biscuit_thickness, mechanical_strength, facility_CycleTime, top_mean, bottom_mean, mold_mean, tb_diff`
- 순서 지킬 것: ① 금형 온도 4개 중 1000 초과는 그 칸만 결측 → ② 파생 계산(채우기 **전**, 결측 빼고 평균) → ③ 남은 결측은 pkl `medians` 로 채움 → ④ float32
- DB 칼럼은 소문자: `facility_CycleTime` → `facility_cycletime`
- pkl 키: `model`·`features`·`threshold`·`medians`·`train`(학습 데이터 설명, v1의 `trained_on` 자리)

## 확인 방법

TM 검증 예시 3샷(모델 폴더 `DieCasting_CatB_20261115_03_검증예시.csv`: 정상 · 결측+불가능값 · 압력0·형체력0)을 넣어 같은 불량 확률이 나오면 연결이 맞습니다.

## 연결 후

알려 주시면 MS가 등록 SQL을 DB에 실행하고, Model Management에서 배포 전환은 같이 정합니다(배포가 바뀌면 1차 판정이 새 모델로 자동 재계산됨).
