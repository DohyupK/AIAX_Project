# DB 연동 — 불량 유형 라벨링 (JH)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-18 |
| 담당 폴더 | JH |
| 기능명 | 불량 유형 라벨링 (`defect_labeling`) |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md#불량-유형-라벨링-defect_labeling) |
| DB 종류 | PostgreSQL (NCP `aiax`) |
| 계정 | 읽기 `app_lake` (루트 `.env` `DATABASE_URL`) / 쓰기 `app_ai` (`AI_DATABASE_URL`, 2026-11-21~) |
| 목적 | 화면 목업(샷 JSON·localStorage 라벨)을 lake 공정 데이터·ai 라벨 테이블로 교체 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `ai.quality_prediction` + `mes.investment_casting` | `casting_id`, `result` / `timestamp`(날짜), `date`(시각), `line_unit` | 읽기 | `/api/casting/defect-dates`, `/api/casting/defects?date=` | (2026-11-20 변경) 불량 샷 = 2차 판정 `result = 'fail'`. 이전: lake `passorfail = 1`. 사진 = MS 이미지 API `GET /api/images/{casting_id}` |
| `ai.defect_label` | `defect_label_idx`, `casting_id`, `blowhole`, `edge_burr`, `surface_rough`, `labeled_at` | 읽기·쓰기(DELETE·INSERT) | 읽기 `/api/casting/defects` (LEFT JOIN), 쓰기 `POST /api/casting/defects/{casting_id}/label` | 라벨 완료 상태·유형 |
| `ai.defect_discard` | `defect_discard_idx`, `casting_id`, `discarded_at` | 읽기·쓰기(DELETE·INSERT) | 위와 같음 | 판정 불가(폐기) 상태 |
| `org.access_code` + `org.defect_labeling_page` | `employee_no`, `access_code`, `access_level` | 읽기 (app_lake) | 저장 API 권한 확인 | edit 만 저장 |

## 메모

- 확인값(2026-11-18): 불량 샷 3,277 / 날짜 63일(2026-08-05 ~ 10-11), 라벨·폐기 행 0.
- ~~쓰기 없음~~ (2026-11-18) → **2026-11-21 저장 연결**: app_ai(MS init 17, SELECT·INSERT·DELETE). 한 트랜잭션에서 그 샷의 기존 라벨·폐기 행 삭제 후 새로 넣음. `_idx` = max+1 (advisory lock 으로 동시 저장 충돌 방지).
