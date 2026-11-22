# DB 연동 — 보호구 착용 위반 대시보드 (JH)

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-18 |
| 담당 폴더 | JH |
| 기능명 | 보호구 착용 위반 대시보드 (`ppe_violation`) — 검사 기록 표·월간 보고서 |
| 기능표 링크 | [JH/기능표.md](../JH/기능표.md#보호구-착용-위반-대시보드-ppe_violation) |
| DB 종류 | PostgreSQL (NCP `aiax`) |
| 계정 | `app_lake` (읽기 전용, 루트 `.env` `DATABASE_URL`) |
| 목적 | 화면 목업(`data.ts`·`monthly.ts`)을 DB 판정·출입 데이터로 교체 |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `ai.ppe_check` | `employee_gate_log_idx`/`vendor_gate_log_idx`, 장구 5종(null=판정 불가), `result`, `manual_result`, `manual_by` | 읽기 | `/api/ppe/dates`·`/checks?from=&to=`(최대 92일)·`/monthly` | lake 사본 없음 → ai 원본 |
| `ai.ppe_gate_rule` | `gate`, 장구별 필수 여부 | 읽기 | `/api/ppe/monthly` (보호구별 필수 미착용 집계) | 화면 `rules.ts` 와 같은 기준 |
| `org.employee_gate_log` | `work_date`, `clock_in_at`, `gate`, `employee_card_id` | 읽기 | 위 3개 | 사원 판정의 시각·게이트 |
| `org.vendor_gate_log` | `work_date`, `clock_in_at`, `vendor_card_id` | 읽기 | 위 3개 | 게이트 칼럼 없음 → `org.gate_card` 로 a/b |
| `org.gate_card` | `vendor_card_id`, `gate_a`, `gate_b` | 읽기 | 위 3개 | 하청 카드는 a·b 중 하나만 열림 |
| `org.employee_card`·`employee`·`department`·`team` | 사번, 부서명, 팀명, 재직 상태 | 읽기 | 위 3개 | 소속 = 부서명. 등록 인원 = casting* 팀 재직 사원 |
| `org.vendor_worker`·`vendor_company` | 카드, 업체명, 발급·반납일 | 읽기 | 위 3개 | 소속 = 업체명. 등록 인원 = 그 달 사용 카드 |

## 메모

- 집계 기준: 판정 수 = 판정 불가 포함 전체, 위반 = `result = 'violation'` 또는 `manual_result = 'violation'`. 확인값(2026-11-18): 2,756판정·위반 82·판정 불가 7(전부 e0039 확인 pass) — MS 전달사항과 일치.
- ~~lake 는 전날 00:00 KST 기준 사본이라 당일 판정은 다음 날부터 보임~~ → **2026-11-19 출입·사람·소속을 org 원본으로 변경** (사용자 결정). 판정(`ai.ppe_check`)이 게이트에서 바로 들어오므로 방금 판정된 건이 바로 보임. 계정 app_lake 그대로(org 읽기 권한 확인), `.env` 변경 없음. 바꾸기 전·후 서버 대조: 날짜 85·검사 기록 3,566건(08-01~10-31)·월간 보고서 4개월 값·리포트 안전 위반 145 모두 같음(월간 업체 목록 순서만 다름 — 화면이 위반율 순 정렬)
- 쓰기 없음. 판정 불가 건 수동 확인 저장은 ai 쓰기 계정 생성 후 (MS).
