# 불량 예측 모델 v2.0 — 입력 변수 정의 (모델 연결용)

모델: `DieCasting_CatB_20261115_03.pkl` (구 이름 `DieCasting_CatB_v2.0_deploy.pkl` / `.cbm`, CatBoost, 전체 데이터 학습)
기준 코드: `predict_v2.py` (`prepare` → `fill` → `predict`). 다른 언어나 시스템으로 옮길 때 이 문서와 같은 결과가 나와야 합니다.

## 1. 필요한 원본 컬럼 (샷 1개당 8개)

| 원본 컬럼 | 의미 | 결측 시 채울 값 (학습 데이터 중앙값) |
|---|---|---|
| top_temp1 | 상형 온도1 | 395.0 |
| top_temp2 | 상형 온도2 | 355.0 |
| bottom_temp1 | 하형 온도1 | 469.0 |
| bottom_temp2 | 하형 온도2 | 403.0 |
| injection_pressure | 사출 압력 (원값 그대로) | 660.0 |
| biscuit_thickness | 비스켓 두께 | 150.0 |
| mechanical_strength | 형체력 (0도 그대로 둠: 설비 이상 신호) | 87.0 |
| facility_CycleTime | 설비 사이클 | 150.0 |

- 그 샷의 값만 쓰면 됩니다. 이전 샷 정보나 런 번호, 시간은 필요 없습니다.
- 용탕량, 슬리브 온도, 용융온도, 냉각수 온도는 모델에 들어가지 않습니다.

## 2. 파생 변수 4개 (그 샷의 금형 온도 4개로 계산)

| 파생 변수 | 정의 | 결측 시 채울 값 |
|---|---|---|
| top_mean | 상형 평균 = (top_temp1 + top_temp2) / 2 | 373.0 |
| bottom_mean | 하형 평균 = (bottom_temp1 + bottom_temp2) / 2 | 446.0 |
| mold_mean | 금형 평균 = (top_mean + bottom_mean) / 2 | 400.5 |
| tb_diff | 상하 온도차 = top_mean − bottom_mean (음수면 하형이 더 뜨거움) | −88.0 |

## 3. 계산 순서 (이 순서를 지켜야 학습 때와 같은 값이 나옴)

1. **불가능한 값을 결측으로 처리**: 금형 온도 4개 중 1000 초과인 값은 그 칸만 결측(NaN)으로 둡니다. 행은 버리지 않습니다.
2. **파생 변수 계산 (결측을 채우기 전)**: 평균은 결측을 빼고 계산합니다(pandas `mean(axis=1)`과 같음).
   - 둘 중 하나만 결측이면 남은 하나의 값이 평균이 됩니다. 예: top_temp1이 결측이고 top_temp2 = 360이면 top_mean = 360입니다.
   - 둘 다 결측이면 평균도 결측입니다.
   - mold_mean이나 tb_diff는 top_mean과 bottom_mean 중 하나라도 결측이면 결측입니다.
3. **결측 채우기**: 남은 결측은 위 표의 중앙값으로 채웁니다. 파생 변수도 원본에서 다시 계산하지 않고, 자기 중앙값으로 채웁니다.
4. **입력 순서**: 아래 12개를 이 순서대로, float32로 넣습니다.
   `top_temp1, top_temp2, bottom_temp1, bottom_temp2, injection_pressure, biscuit_thickness, mechanical_strength, facility_CycleTime, top_mean, bottom_mean, mold_mean, tb_diff`
5. **예측**: 불량 확률 = `predict_proba(X)[:, 1]`.
6. **경보**: 불량 확률 ≥ 0.5552428906678332 이면 경보(1), 아니면 0입니다. 발표에서는 0.555로 표기했습니다.

## 4. 주의

- 결측을 먼저 채운 뒤 파생 변수를 계산하면 학습 때와 값이 달라집니다. 반드시 2번(파생 계산)을 3번(결측 채우기)보다 먼저 하세요.
- 중앙값과 임계값은 `.pkl` 안에도 들어 있습니다(`bundle["medians"]`, `bundle["threshold"]`). `.cbm` 파일만 쓸 때는 이 문서의 값을 사용하세요. (저장소에는 `.pkl`만 있음)
- 온도 단위와 컬럼 의미는 원본 데이터(Investment_Casting.csv)와 같아야 합니다.
- 연결 결과 확인용 예시 3샷은 `입력변수_검증예시.csv`에 있습니다. 원본 값을 넣었을 때 같은 불량 확률이 나오면 연결이 맞는 것입니다. → 이 폴더의 [`DieCasting_CatB_20261115_03_검증예시.csv`](DieCasting_CatB_20261115_03_검증예시.csv)
