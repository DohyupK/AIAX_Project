# DB 연동 — 불량 유형 라벨링 (JH)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-18 |
| 담당 폴더 | JH |
| 기능명 | 불량 유형 라벨링 (`defect_labeling`) |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md#불량-유형-라벨링-defect_labeling) |
| DB 종류 | PostgreSQL (NCP `aiax`) |
| 계정 | `app_lake` (읽기 전용, 루트 `.env` `DATABASE_URL`) |
| 목적 | 화면 목업(샷 JSON·localStorage 라벨)을 lake 공정 데이터·ai 라벨 테이블로 교체 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `lake.lake_investment_casting` | `casting_id`, `timestamp`(날짜), `date`(시각), `passorfail` | 읽기 | `/api/casting/defect-dates`, `/api/casting/defects?date=` | 불량 샷 = `passorfail = 1` (DL 모델 연결 전). 라인 칼럼 없음(전부 line_no1) |
| `ai.defect_label` | `casting_id`, `blowhole`, `edge_burr`, `surface_rough`, `labeled_at` | 읽기 | `/api/casting/defects` (LEFT JOIN) | 라벨 완료 상태·유형 |
| `ai.defect_discard` | `casting_id`, `discarded_at` | 읽기 | `/api/casting/defects` (LEFT JOIN) | 판정 불가(폐기) 상태 |

## 메모

- 확인값(2026-11-18): 불량 샷 3,277 / 날짜 63일(2026-08-05 ~ 10-11), 라벨·폐기 행 0.
- **쓰기 없음**: app_lake 에 ai INSERT 권한 없음 → 화면 저장 비활성 (사용자 결정 B). 쓰기 계정 생성 후 저장 API 추가 예정 (MS 와 계정 협의).
