# DB 연동 기록 — JH / 인사 관리 (hr_management) + lake 복제·변경 기록

## 메타

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-11-16 |
| 담당 폴더 | JH |
| 기능명 | 인사 관리 페이지(`/hr`) + 인사 API(`JH/api/hr`) / mes·org → lake 복제·변경 기록 |
| 기능표 링크 | [JH/main/README.md](../JH/main/README.md) |
| DB 종류 | PostgreSQL (NCP `aiax`) — 목업 SQLite 아님 |
| 목적 | 인사 화면이 org 원본을 실시간 조회·변경 / lake 자동 갱신 준비 |
| 승인 | DH·MS (2026-11-16, 사용자 경유) |

## 테이블·연동

| 테이블명 | 주요 컬럼 | 읽기/쓰기 | 연동 화면·API | 비고 |
|----------|-----------|-----------|---------------|------|
| `org.employee`·`employee_info`·`employee_status` | 사번·부서·직급·팀 / 이름·나이·성별·전화·주소·이메일 / 근속·연차·초과근무 | 읽기·쓰기 | `/hr`, `GET/POST/PATCH/DELETE /api/hr/employees` | 권한 등급별 칼럼만 응답 (`JH/api/hr/rules.py`) |
| `org.access_code`·`dept_roster`·`team_roster` | 사번·권한 숫자·부서/팀 명단 | 쓰기 | 사원 추가·수정·삭제 시 같이 맞춤 | 한 트랜잭션 |
| `org.department`·`team`·`position` | 이름·대표·직급코드 | 읽기 | `GET /api/hr/summary` | |
| `org.employee_card`·`attendance` | 사번 | 읽기 | 삭제 전 참조 확인 | 있으면 삭제 거부 (기록 손실 방지) |
| `org.hr_access_log` (신규) | 조회자·행동·대상·등급·행 수·시각 | 쓰기(추가만) | 모든 인사 API | 개인정보 접속기록. app_hr 은 추가만, 수정·삭제 불가 |
| `lake.lake_<org 테이블>` 23개 (신규) | org 와 동일 | — | (분석용, 화면 미사용) | `employee_info` 제외. 첫 전체 복제 완료 |
| `mes.investment_casting_change_log`, `org.change_log`, `lake.etl_watermark` (신규) | 변경 키·op·시각 / 처리 위치 | 트리거가 쓰기 | 00:00 KST Spark 갱신용 (MS 예정) | |

## 접속 설정 (비밀 값 제외)

| 항목 | 내용 |
|------|------|
| 계정 | `app_hr` (신규) — org 인사 테이블만, mes·lake·mart 접근 불가 |
| URL 위치 | 루트 `.env` → `HR_DATABASE_URL` (비밀번호 `APP_HR_PASSWORD`) |
| API 실행 | `cd JH/api && uv run uvicorn main:app --host 127.0.0.1 --port 8000` — 로그인 전이라 **127.0.0.1 전용** |

## 메모

- 적용 SQL: [`JH/전달사항/sql/2026-11-16_lake_sync_setup.sql`](../JH/전달사항/sql/2026-11-16_lake_sync_setup.sql), [`JH/전달사항/sql/2026-11-16_hr_api_setup.sql`](../JH/전달사항/sql/2026-11-16_hr_api_setup.sql)
- MS 요청: 위 SQL `MS/db/init/` 반영, `app_hr` 를 `00_roles.sh` 에 추가, 루트 `DB구조.md` 갱신, 실행기·Spark 작업 ([전달 문서](../JH/전달사항/2026-11-16_MS_mes변경시_lake자동갱신_요청.md))
- 검증 시 시험 사원 `E30019` 를 추가→수정→삭제함 → `org.change_log` 에 I/U/D 기록과 `org.hr_access_log` 에 시험 조회 기록이 남아 있음 (데이터는 원래 53명으로 복구됨, Spark 반영 시 순 변화 없음)

## 변경 (2026-11-17) — org DB 개편 대응

- `org.employee_info`: `age` 열 삭제, `birth_date`(date) 추가 → API는 `age(birth_date)` 로 만 나이를 계산해 내려주고, 추가·수정 시 `birth_date` 저장
- 코드 체계: 부서 1000~7000(경영부 1000), 직급 10000(인턴)~70000(소장), 팀 10~60(정수), 사번 `e0001`~ 일련번호
- `org.access_code` = 직급코드 + 부서코드 + 팀코드 + 부서 대표 100 + 팀 대표 1 (2026-11-17 DB 54명 대조 일치)
- 검증 시 로컬 API로 조회 시험 → `org.hr_access_log` 에 시험 조회 기록 약 10건 남음 (데이터 변경 없음, 추가 시도는 모두 검증 단계에서 거부)
