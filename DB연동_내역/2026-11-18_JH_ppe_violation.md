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
| `lake.lake_employee_gate_log` | `work_date`, `clock_in_at`, `gate`, `employee_card_id` | 읽기 | 위 3개 | 사원 판정의 시각·게이트 |
| `lake.lake_vendor_gate_log` | `work_date`, `clock_in_at`, `vendor_card_id` | 읽기 | 위 3개 | 게이트 칼럼 없음 → `lake_gate_card` 로 a/b |
| `lake.lake_gate_card` | `vendor_card_id`, `gate_a`, `gate_b` | 읽기 | 위 3개 | 하청 카드는 a·b 중 하나만 열림 |
| `lake.lake_employee_card`·`lake_employee`·`lake_department`·`lake_team` | 사번, 부서명, 팀명, 재직 상태 | 읽기 | 위 3개 | 소속 = 부서명. 등록 인원 = casting* 팀 재직 사원 |
| `lake.lake_vendor_worker`·`lake_vendor_company` | 카드, 업체명, 발급·반납일 | 읽기 | 위 3개 | 소속 = 업체명. 등록 인원 = 그 달 사용 카드 |

## 메모

- 집계 기준: 판정 수 = 판정 불가 포함 전체, 위반 = `result = 'violation'` 또는 `manual_result = 'violation'`. 확인값(2026-11-18): 2,756판정·위반 82·판정 불가 7(전부 e0039 확인 pass) — MS 전달사항과 일치.
- lake 는 전날 00:00 KST 기준 사본이라, 당일 판정은 출입 로그가 lake 에 반영된 다음 날부터 보임 (inner join). 실시간이 필요하면 `lake.lake_*` → `org.*` (칼럼 동일).
- 쓰기 없음. 판정 불가 건 수동 확인 저장은 ai 쓰기 계정 생성 후 (MS).
