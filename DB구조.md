# AIAX PostgreSQL 구조 (현행)

| 항목 | 내용 |
|------|------|
| DB 이름 | `aiax` |
| 근거 코드 | [`MS/db/init/`](MS/db/init/) |
| 명명·연동 문서 | [`DB연동_내역/`](DB연동_내역/) · [`MS/db/명명규칙.md`](MS/db/명명규칙.md)(포인터) |
| 최종 반영일 | 2026-11-17 |

---

## 필수: 수정 시 이 문서를 같이 갱신

**스키마·테이블·컬럼·제약·계정을 바꾸면 반드시 이 파일(`DB구조.md`)을 같은 PR/작업에서 업데이트한다.**

| 담당 | 할 일 |
|------|--------|
| **MS** | `MS/db/init/` 코드. 변경 시 본 문서 + [`DB연동_내역/`](DB연동_내역/) 맞춤 (MS README는 기동 stub) |
| 다른 폴더 | 스키마를 바꾸지 않음. 참조만. DB 사용은 [`DB연동_내역/`](DB연동_내역/)에 기록 |
| 에이전트 | init/SQL을 수정했으면 **이 문서 미갱신을 완료로 치지 않음** |

체크리스트 (변경할 때마다):

1. [ ] `MS/db/init/` SQL과 본 문서 표가 일치하는가  
2. [ ] 컬럼 추가·삭제·타입·NULL·FK가 반영됐는가  
3. [ ] 계정·권한이 바뀌었으면 「계정」절도 고쳤는가  
4. [ ] 아래 「변경 이력」에 날짜·요약을 남겼는가  

---

## 스키마

| 스키마 | 역할 |
|--------|------|
| `mes` | 원본 보관 (가공하지 않음) |
| `lake` | 정제 데이터 (Spark) |
| `mart` | 학습·분석용 (Spark → AI) |
| `org` | 조직·권한·하청·게이트·근태. init `09`·`10` (2026-11-17 새 구조, MS) |

관계: `mes` →(FK)·`lake` →(FK)·`mart` (`casting_id`). `org`는 독립.

---

## 계정 (로그인)

| 계정 | 용도 | mes | lake | mart | org |
|------|------|-----|------|------|-----|
| `shift` | 관리 (`POSTGRES_USER`) | 전체 | 전체 | 전체 | 전체 |
| `app_mes` | 원본 적재 | 읽기·쓰기(삭제 불가) | - | - | - |
| `app_spark` | 배치 | 읽기 | 읽기·쓰기 | 읽기·쓰기 | 읽기 (`employee_info`·`hr_access_log` 제외) |
| `app_mart` | 학습 읽기 | - | - | 읽기 | - |
| `app_lake` | 조회 (DH 등) | 읽기 | 읽기 | 읽기 | 읽기 |
| `app_hr` | 인사 관리 API (JH/api/hr) | - | - | - | 인사 테이블 읽기·쓰기, `hr_access_log` 추가만 |

권한 그룹: `role_mes`, `role_spark`, `role_mart`, `role_lake`. `app_hr`은 그룹 없이 org 테이블별 GRANT (`09`). 비밀번호는 루트 `.env`의 `APP_HR_PASSWORD`.

### 이름 혼동 주의 (`app_lake` ≠ 스키마 `lake`만)

| 이름 | 무엇인가 | 자주 하는 오해 |
|------|----------|----------------|
| **스키마 `lake`** | 정제 데이터가 들어가는 **칸막이** | — |
| **계정 `app_lake`** | DH 등 **조회 전용 로그인** (구 readonly) | “lake 스키마만 다룬다” |

`app_lake`는 스키마 `lake` 전용 계정이 **아니다**.  
권한은 **`mes` / `lake` / `mart` / `org` SELECT** 이다. (쓰기·DDL은 `shift` 등)

### `org` (조직·권한·하청·게이트·근태)

근거: [`MS/db/init/09_org_permission.sql`](MS/db/init/09_org_permission.sql) (구조·트리거·권한), 목업 [`10_org_permission_seed.sql`](MS/db/init/10_org_permission_seed.sql).  
설명서·바뀐 점: [`MS/전달사항/2026-11-17_org_새구조/`](MS/전달사항/2026-11-17_org_새구조/) (접근 코드 규칙, 페이지 권한 기준, 근무 기준).  
상세: [`DB연동_내역/조직권한_테이블구조.md`](DB연동_내역/조직권한_테이블구조.md).

| 구분 | 테이블 |
|------|--------|
| 마스터 | `"position"`, `department`, `team`, `page`, `vendor_company` |
| 사원 | `employee`, `employee_info`, `employee_status`, `access_code`, `dept_roster`, `team_roster` |
| 카드·게이트 | `employee_card`, `vendor_worker`, `gate_card`, `employee_gate_log`, `vendor_gate_log` |
| 근태 | `attendance`, `employee_record` |
| 페이지 권한 9 | `main_page`, `process_optimization_page`, `quality_inspection_page`, `defect_labeling_page`, `worker_safety_page`, `hr_management_page`, `management_report_page`, `model_management_page`, `company_documents_page` |
| 앱 기록 | `change_log` (모든 org 변경, lake 복제용), `hr_access_log` (개인정보 조회 기록) |

| 코드 | 값 |
|------|----|
| 사번 / 사원증 / 하청업체 / 하청 카드 | `e0001` / `ec0001` / `v0001` / `vc0001` (일련번호) |
| `position_code` | 10000 인턴 ~ 70000 소장 |
| `dept_code` | 1000 경영 ~ 7000 R&D (integer) |
| `team_code` | 10 casting1 ~ 60 tf (integer), 이름은 `team_name`, 팀 없음 = NULL |
| 접근 코드 | 직급 + 부서 + 부서장 100 + 팀 + 팀장 1 (예: 소장 71100) |

트리거 (자동으로 맞춰지는 것):

| 바뀌는 것 | 자동으로 바뀌는 것 |
|-----------|-------------------|
| `employee` 직급·부서·팀, `department`·`team` 대표자 | `access_code`, `dept_roster`, `team_roster` |
| `employee_gate_log` IN | `attendance`, `employee_card.attendance_status` = present |
| `employee_gate_log` OUT | `employee_record`(근무시간·지각·조퇴·초과), `attendance_status` = absent, `employee_status.last_logout_at` |
| `employee_record.absent` = true | `employee_status.annual_leave_used` +1 |
| org 테이블 전부 (앱 기록 2개 제외) | `change_log` |

---

## 테이블·컬럼

### `mes.investment_casting` (원본, 컬럼 24 = casting_id + 원본 23)

| 컬럼 | 타입 | 제약·비고 |
|------|------|-----------|
| `casting_id` | `text` | PK. `GENERATED ALWAYS` (일자+시각+생산번호). 적재 시 입력 금지 |
| `line_unit` | `text` | |
| `production` | `text` | |
| `timestamp` | `date` | 원본 일자 컬럼명 |
| `date` | `time` | 원본 시각 컬럼명 |
| `production_count` | `integer` | |
| `mold_temperature` | `double precision` | |
| `facility_cycletime` | `double precision` | |
| `production_cycletime` | `double precision` | |
| `mechanical_strength` | `double precision` | |
| `molten_capacity` | `double precision` | |
| `injection_pressure` | `double precision` | |
| `sleeve_temperature` | `double precision` | |
| `top_temp1` ~ `top_temp4` | `double precision` | |
| `bottom_temp1` ~ `bottom_temp4` | `double precision` | |
| `biscuit_thickness` | `double precision` | |
| `cooling_water_temp` | `double precision` | |
| `passorfail` | `smallint` | |

인덱스: `investment_casting_date_idx` on (`timestamp`, `date`).

### `lake.lake_investment_casting` (정제, 컬럼 21 = casting_id + 20)

mes에서 제외: `line_unit`, `production`, `production_count` (casting_id에 포함).

| 컬럼 | 타입 | 제약·비고 |
|------|------|-----------|
| `casting_id` | `text` | PK, FK → `mes.investment_casting(casting_id)` |
| `timestamp` | `date` | |
| `date` | `time` | |
| `mold_temperature` | `double precision` | |
| `facility_cycletime` | `double precision` | |
| `production_cycletime` | `double precision` | |
| `mechanical_strength` | `double precision` | |
| `molten_capacity` | `double precision` | |
| `injection_pressure` | `double precision` | |
| `sleeve_temperature` | `double precision` | |
| `top_temp1` ~ `top_temp4` | `double precision` | |
| `bottom_temp1` ~ `bottom_temp4` | `double precision` | |
| `biscuit_thickness` | `double precision` | |
| `cooling_water_temp` | `double precision` | |
| `passorfail` | `smallint` | |

### `mart.mart_investment_casting` (학습, 컬럼 19 = casting_id + 18)

lake에서 제외: `timestamp`, `date`.  
적재 시 `molten_capacity` 결측·`passorfail` 빈 행은 넣지 않음 (설계 메모).

| 컬럼 | 타입 | 제약·비고 |
|------|------|-----------|
| `casting_id` | `text` | PK, FK → `lake.lake_investment_casting(casting_id)` |
| `mold_temperature` | `double precision` | |
| `facility_cycletime` | `double precision` | |
| `production_cycletime` | `double precision` | |
| `mechanical_strength` | `double precision` | |
| `molten_capacity` | `double precision` | |
| `injection_pressure` | `double precision` | |
| `sleeve_temperature` | `double precision` | |
| `top_temp1` ~ `top_temp4` | `double precision` | |
| `bottom_temp1` ~ `bottom_temp4` | `double precision` | |
| `biscuit_thickness` | `double precision` | |
| `cooling_water_temp` | `double precision` | |
| `passorfail` | `smallint` | **NOT NULL** |

---

## init 파일 대응

| 파일 | 내용 |
|------|------|
| `00_roles.sh` | role_* / app_* |
| `01_schemas.sql` | mes·lake·mart, CONNECT |
| `03_mes.sql` | `mes.investment_casting` |
| `04_lake.sql` | `lake.lake_investment_casting` |
| `05_mart.sql` | `mart.mart_investment_casting` |
| `06_grants.sql` | 권한 |
| `07_comments.sql` | COMMENT |
| `08_data.sql.gz` | 샘플 데이터 |
| `09_org_permission.sql` | schema `org` 구조 + 트리거 + GRANT (app_hr 포함) |
| `10_org_permission_seed.sql` | `org` 목업 (사원 54, 2026-08-04~10-11 출입·근무) |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-11-17 | `org` 새 구조 (MS): 코드 숫자화·일련번호, `vender`→`vendor`, `age`→`birth_date`, 페이지 권한 9개(접근 코드 기준), 트리거(접근 코드·명단·근태), `app_hr` 계정 init 반영. 서버 적용 완료 |
| 2026-11-16 | schema `org` (DH). init 09/10. `app_lake` SELECT. DB 서술 → `DB연동_내역`. SQLite·MS DB 장문 정리 |
| 2026-11-10 | 현행 init 기준으로 루트 문서 신설. 계정 `shift` / `app_mes`·`app_spark`·`app_mart`·`app_lake`. 지속 갱신 의무 명시 |
| 2026-11-10 | `app_lake` vs 스키마 `lake` 혼동 주의 절 추가 |
