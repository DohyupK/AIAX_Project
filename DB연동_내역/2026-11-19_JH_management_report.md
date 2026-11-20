# DB 연동 — 경영 관리자 리포트 (JH)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-19 |
| 담당 폴더 | JH |
| 기능명 | 경영 관리자 리포트 (`management_report`) — 전 항목 (생산·불량·SPC·안전·근태·고정값) |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md#경영-관리자-리포트-management_report) |
| DB 종류 | PostgreSQL (NCP `aiax`) |
| 계정 | `app_lake` (읽기 전용, 루트 `.env` `DATABASE_URL`) |
| 목적 | 리포트 목업 중 서버 데이터로 바로 만들 수 있는 생산량·불량만 실제 값으로 교체 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `mes.investment_casting` | `timestamp`(생산일), `passorfail` | 읽기 | `GET /api/report/daily?from=&to=` (날짜별 샷 수·불량 수, 최대 220일) · `GET /api/report/first-date` (`min(timestamp)` = 목록 시작일, 2026-11-21 추가) | 세 라인(line_no1~3) 합계. 불량 = 실제 판정 `passorfail = 1`. 시작일은 목록 페이지 수 계산용 |
| `ai.ppe_check` + `org.employee_gate_log`·`employee_card`·`employee`·`department`·`vendor_gate_log`·`vendor_worker`·`vendor_company`·`gate_card` | 장구 5종, `result`, `manual_result`, 출입 `work_date` | 읽기 | `GET /api/report/safety?from=&to=` (날짜별 판정 수 + 위반 건) | 2026-11-19 추가. 보호구 API(`ppe/router.py` `CHECKS`·`VIOLATION`)와 같은 SQL — 같은 날 보호구가 lake 사본 → **org 원본**으로 바뀌어 함께 원본 기준. 기록 [2026-11-18_JH_ppe_violation.md](2026-11-18_JH_ppe_violation.md) |
| `org.fixed_value` | `value_name`, `value`, `unit`, `effective_date` | 읽기 | `GET /api/report/fixed` (전체 행) | 2026-11-20 추가. 화면이 리포트 기간 마지막 날 기준으로 이름별 최신 값 선택 — 제품_단가·재활용_회수액·재활용률·MTTR·MTBF·리콜_횟수_12개월 |
| `mes.spc_limit` (+ `mes.investment_casting`) | `line_unit`, `variable`, `i_lcl`, `i_ucl`, `effective_date` | 읽기 | `GET /api/report/spc?from=&to=` (날짜별 UCL 초과·LCL 미만 「샷 × 변수」 수) | 2026-11-20 추가. 적용 시작일 ~ 다음 적용 시작일 전까지 그 기준선 사용 |
| `org.employee_record` | `work_date`, `absent` | 읽기 | `GET /api/report/attendance?from=&to=` (날짜별 근무 예정자·출근) | 2026-11-20 추가. 근무 예정자 = 그날 근무 기록 행, 출근 = 결근 아님 (`org.attendance` 와 1:1 일치) |

## 메모

- 확인값(2026-11-19): 데이터 2026-08-04 ~ 11-30, 05-01 ~ 11-19 조회 103일 · 생산 115,914 · 불량 5,163, 0.24초
- 안전 확인값: 05-01 ~ 11-30 판정 4,703 · 위반 145 (0.37초). 보호구 월간 보고서와 9·10·11월 판정·위반 일치
- 연결 안 한 항목(데이터 없음·기준 미정): 근태(`org.attendance` — 총원 기준 미정), SPC, 1차 불량(저장 결과 없음), 불량 유형(`ai.defect_label` 0행·코드 다름), 재활용·MTTR·MTBF·리콜(데이터 없음)
