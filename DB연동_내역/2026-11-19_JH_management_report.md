# DB 연동 — 경영 관리자 리포트 (JH)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-19 |
| 담당 폴더 | JH |
| 기능명 | 경영 관리자 리포트 (`management_report`) — 생산량·최종 불량, 안전 |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md#경영-관리자-리포트-management_report) |
| DB 종류 | PostgreSQL (NCP `aiax`) |
| 계정 | `app_lake` (읽기 전용, 루트 `.env` `DATABASE_URL`) |
| 목적 | 리포트 목업 중 서버 데이터로 바로 만들 수 있는 생산량·불량만 실제 값으로 교체 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `mes.investment_casting` | `timestamp`(생산일), `passorfail` | 읽기 | `GET /api/report/daily?from=&to=` (날짜별 샷 수·불량 수, 최대 220일) | 세 라인(line_no1~3) 합계. 불량 = 실제 판정 `passorfail = 1` |
| `ai.ppe_check` + `lake.lake_employee_gate_log`·`lake_employee_card`·`lake_employee`·`lake_department`·`lake_vendor_gate_log`·`lake_vendor_worker`·`lake_vendor_company`·`lake_gate_card` | 장구 5종, `result`, `manual_result`, 출입 `work_date` | 읽기 | `GET /api/report/safety?from=&to=` (날짜별 판정 수 + 위반 건) | 2026-11-19 추가. 보호구 API(`ppe/router.py` `CHECKS`·`VIOLATION`)와 같은 SQL — 기록 [2026-11-18_JH_ppe_violation.md](2026-11-18_JH_ppe_violation.md) |

## 메모

- 확인값(2026-11-19): 데이터 2026-08-04 ~ 11-30, 05-01 ~ 11-19 조회 103일 · 생산 115,914 · 불량 5,163, 0.24초
- 안전 확인값: 05-01 ~ 11-30 판정 4,703 · 위반 145 (0.37초). 보호구 월간 보고서와 9·10·11월 판정·위반 일치
- 연결 안 한 항목(데이터 없음·기준 미정): 근태(`org.attendance` — 총원 기준 미정), SPC, 1차 불량(저장 결과 없음), 불량 유형(`ai.defect_label` 0행·코드 다름), 재활용·MTTR·MTBF·리콜(데이터 없음)
