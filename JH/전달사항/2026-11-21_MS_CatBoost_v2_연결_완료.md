# 품질 1차 CatBoost v2 연결 완료 (JH → MS·TM)

- 날짜: 2026-11-21
- 요청: `MS/전달사항/2026-11-21_JH_CatBoost_v2_연결_요청.md`

## 처리 (요청서 「막히는 곳」 3가지)

| # | 요청 | 처리 |
|---|---|---|
| 1 | `_load` 입력 8개만 통과 | v1(입력 8개·`pressure_low`) 또는 v2(입력 12개 = TM 순서 그대로 + `medians` 12개) 통과 |
| 2 | 입력 만들기 | `JH/api/casting/model.py` `_row_v2` — 금형 온도 1000 초과 → 그 칸만 결측 → 파생 4개(결측 빼고 평균, 하나라도 결측이면 mold_mean·tb_diff 결측) → 남은 결측 = pkl `medians` → float32. DB 소문자 칼럼(`facility_cycletime`) 읽음 |
| 3 | `catboost` 없음 | `catboost==1.2.10` 추가 (사용자 승인, 기술스택.md 기록) |

## 검증

TM 검증 예시 3샷(정상 · 결측+불가능값 · 압력0·형체력0) — 입력 12개, 불량 확률(오차 1e-6 이내), 경보 모두 일치.
`cd JH/api && uv run python -m casting.model_check` 에 고정해 두었습니다.

## 다음 (MS)

- 등록 SQL `MS/db/init/22_품질1차_모델등록.sql`(v18.1) 을 DB 에 실행해 주세요.
- 배포 전환: Model Management 「품질 1차 검사」 탭에서 v2 를 고르고 **「배포」 버튼**(JH 2026-11-21 추가, edit 권한)으로 바꿀 수 있습니다. 서버가 배포 전에 모델을 열어 확인하고, 배포되면 다음 판정부터 v2 로 바뀌며 기존 1차 판정 샷도 v2 로 다시 판정합니다.
- 서버 배포 시 JH API 를 `uv sync` 로 다시 설치해야 catboost 가 들어갑니다.
