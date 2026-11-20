# AIAX PostgreSQL 구조 (현행)

| 항목 | 내용 |
|------|------|
| DB 이름 | `aiax` |
| 근거 코드 | [`MS/db/init/`](MS/db/init/) |
| 명명·연동 문서 | [`DB연동_내역/`](DB연동_내역/) · [`MS/db/명명규칙.md`](MS/db/명명규칙.md)(포인터) |
| 최종 반영일 | 2026-11-19 |

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
| `mes` | 공정 원본 보관 (가공하지 않음): 주조 수치, 주조 이미지, 변경 기록 |
| `lake` | 정제 데이터 (Spark) + `org` 복사본 26개 (`lake_<테이블>`) |
| `mart` | 학습·분석용 (Spark → AI) |
| `org` | 조직·권한·하청·게이트·근태 + 고정값·사내 문서. init `09`·`10`·`14`·`15` |
| `ai` | 사람·AI가 만드는 판정·라벨·모델 정보. init `11`·`14` |

관계: `mes` →(FK)·`lake` →(FK)·`mart` (`casting_id`). `org`는 독립. `ai`는 `mes`(casting_id)·`org`(출입 로그·사원)를 FK로 참조.

### 어디에 무엇이 있나 (빠른 찾기)

| 찾는 것 | 원본 (쓰기) | 복사본·가공본 (읽기) |
|---------|-------------|----------------------|
| 주조 수치 | `mes.investment_casting` | `lake.lake_investment_casting` → `mart.mart_investment_casting` |
| 주조 이미지 | `mes.casting_image` | `lake.lake_casting_image` |
| 관리도(SPC) 기준선 | `mes.spc_limit` (JH `spc.py` 표 39행) | 복사본 없음 |
| 사원·조직·출입·근태·페이지 권한 | `org.*` | `lake.lake_*` (같은 이름, 26개) |
| 고정값·사내 문서·일일 공지 | `org.fixed_value`, `org.company_document`, `org.document_chunk`, `org.document_chunk_embedding`, `org.document_chunk_job`, `org.process_alert_daily_notice` | 복사본 없음 |
| 모델·판정·라벨 | `ai.*` | 복사본 없음 |

> **복사본 갱신 상태 (2026-11-19):** Kafka·Flink·Spark·`lake_runner` 는 **MS PC(Docker)** 에서 실행 (서버는 Postgres·웹만). `lake` 의 `org` 복사본·주조 수치는 `lake_runner` 가 매일 00:00 KST 갱신 — MS PC 가 꺼져 있으면 다음에 켤 때 따라잡음 (`lake.etl_watermark` 의 `last_run_at` 으로 확인). `mart` 는 갱신 작업 자체가 없음 (line_no1 2026-08-04~10-11, 57,295행 고정). 이미지 복사본(`lake_casting_image`)은 DH 이미지 파이프라인이 별도로 갱신.

---

## 계정 (로그인)

| 계정 | 용도 | mes | lake | mart | org | ai |
|------|------|-----|------|------|-----|----|
| `shift` | 관리 (`POSTGRES_USER`) | 전체 | 전체 | 전체 | 전체 | 전체 |
| `app_mes` | 원본 적재 (Flink 이미지 포함) | 읽기·쓰기(삭제 불가) | - | - | - | - |
| `app_spark` | 배치 | 읽기 | 읽기·쓰기 | 읽기·쓰기 | 읽기 (`employee_info`·`hr_access_log` 제외) | 읽기 |
| `app_mart` | 학습 읽기 | - | - | 읽기 | - | - |
| `app_lake` | 조회 (DH·JH API 등) | 읽기 | 읽기 | 읽기 | 읽기 | 읽기 |
| `app_hr` | 인사 관리 API (JH/api/hr)·로그인 | - | - | - | 인사 테이블 읽기·쓰기, `hr_access_log` 추가만, `app_user` 읽기·추가·`last_login_at`·`password_hash` 수정 | - |
| `app_ai` | 모델 관리·라벨링·품질 2차 저장 API (JH) | - | - | - | - | 아래 표 |
| `app_docs` | 사내 문서함 API (JH/api/documents) | - | - | - | 문서 4개 읽기·쓰기, `employee`·`employee_info` 읽기 | - |

권한 그룹: `role_mes`, `role_spark`, `role_mart`, `role_lake`. `app_hr`·`app_ai`·`app_docs`는 그룹 없이 테이블별 GRANT (`09`, `17`·`18`, `19`). 비밀번호는 루트 `.env`의 `APP_HR_PASSWORD`, `APP_AI_PASSWORD`, `DOCS_DATABASE_URL`.

`app_ai` 권한 (`17`·`18`):

| 테이블 | 권한 |
|--------|------|
| `model_registry`, `model_metric_cast_qc1`·`_cast_qc2`·`_safe_ppe` | SELECT, INSERT, UPDATE |
| `model_robustness` | SELECT, INSERT, DELETE |
| `quality_prediction` | SELECT, INSERT, UPDATE |
| `defect_label`, `defect_discard` | SELECT, INSERT, DELETE |
| 그 밖 (`ppe_check` 등) | 없음 |

### 이름 혼동 주의 (`app_lake` ≠ 스키마 `lake`만)

| 이름 | 무엇인가 | 자주 하는 오해 |
|------|----------|----------------|
| **스키마 `lake`** | 정제 데이터가 들어가는 **칸막이** | — |
| **계정 `app_lake`** | DH 등 **조회 전용 로그인** (구 readonly) | “lake 스키마만 다룬다” |

`app_lake`는 스키마 `lake` 전용 계정이 **아니다**.  
권한은 **`mes` / `lake` / `mart` / `org` / `ai` SELECT** 이다. (쓰기·DDL은 `shift` 등)

### `org` (조직·권한·하청·게이트·근태)

근거: [`MS/db/init/09_org_permission.sql`](MS/db/init/09_org_permission.sql) (구조·트리거·권한), 목업 [`10_org_permission_seed.sql`](MS/db/init/10_org_permission_seed.sql).  
설명서·바뀐 점: [`MS/전달사항/2026-11-17_org_새구조/`](MS/전달사항/2026-11-17_org_새구조/) (접근 코드 규칙, 페이지 권한 기준, 근무 기준).  
상세: [`DB연동_내역/조직권한_테이블구조.md`](DB연동_내역/조직권한_테이블구조.md).

| 구분 | 테이블 |
|------|--------|
| 마스터 | `"position"`, `department`, `team`, `page`, `vendor_company` |
| 사원 | `employee`, `employee_info`, `employee_status`, `access_code`, `dept_roster`, `team_roster` |
| 로그인 | `app_user` (웹 로그인 계정, 사번 1:1, `password_hash` scrypt). 이름·이메일은 `employee_info` — `31` |
| 카드·게이트 | `employee_card`, `vendor_worker`, `gate_card`, `employee_gate_log`, `vendor_gate_log` |
| 근태 | `attendance`, `employee_record` |
| 페이지 권한 9 | `main_page`, `process_optimization_page`, `quality_inspection_page`, `defect_labeling_page`, `ppe_violation_page`, `hr_management_page`, `management_report_page`, `model_management_page`, `company_documents_page` |
| 앱 기록 | `change_log` (모든 org 변경, lake 복제용), `hr_access_log` (개인정보 조회 기록) |
| 고정값 | `fixed_value` (단가 등 이름-값, 날짜별 이력. PK `value_name`+`effective_date`) — `14`·`20`. 값: 제품_단가, 재활용_회수액, 재활용률, MTTR, MTBF, 리콜_횟수_12개월 |
| 사내 문서 | `company_document` (문서 메타, 파일은 `file_path`), `document_chunk` (LLM 참조용 텍스트 조각) — `15` / `document_chunk_embedding` (조각별 임베딩 `real[1536]`), `document_chunk_job` (청킹 상태: pending·ok·retry_5m·midnight_pending) — `19` (DH) |
| 일일 공정알람 공지 | `process_alert_daily_notice` (메인 AI 공지 캐시, PK `notice_date`) — DH SQL `06` → MS init 편입 예정. `app_lake` SELECT/INSERT/UPDATE |

`fixed_value`·`company_document`·`document_chunk`·`document_chunk_embedding`·`document_chunk_job`·`process_alert_daily_notice`·`app_user` 는 **`change_log` 트리거 없음, lake 복사 대상 아님** (2026-11-20 기준).

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
| `employee.employment_status` = resigned (퇴사일 필수, 부서장·팀장 불가) | 사원증 `gate_card` a·b 차단 (재직으로 돌리면 다시 열림) |
| org 테이블 (앱 기록 2개, `14`·`15` 테이블 제외) | `change_log` |

---

## 테이블·컬럼

### `mes.investment_casting` (원본, 컬럼 24 = casting_id + 원본 23)

| 컬럼 | 타입 | 제약·비고 |
|------|------|-----------|
| `casting_id` | `text` | PK. `GENERATED ALWAYS` = `L라인번호_yymmdd_hhmmss_생산번호` (예: `L1_260804_070411_1`). 적재 시 입력 금지. 2026-11-19 라인 번호 추가 (전에는 라인 없이 날짜_시각_생산번호 → 라인 간 번호 겹침) |
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

### `mes.casting_image` / `lake.lake_casting_image` (주조 이미지) — `13`

| 컬럼 | 타입 | 제약·비고 |
|------|------|-----------|
| `casting_id` | `text` | PK. mes 쪽은 FK → `mes.investment_casting` (lake 쪽 FK 없음) |
| `original_uri` | `text` | 원본 위치 이력만. **다시 불러오지 않음** |
| `content_type` | `text` | 기본 `image/jpeg` |
| `image_base64` | `text` | 이미지 본문 |
| `updated_at` / `created_at` | `timestamptz` | |
| `lake_synced_at` | `timestamptz` | lake 쪽만. 복사 시각 |

흐름: 카메라 → Kafka → Flink(`MS/db/flink/jobs/image_ingest.py`) → `mes.casting_image` → `aiax.image.spark_sync` 신호 → lake 복사.

### 변경 기록·처리 위치 — `12`

| 테이블 | 용도 |
|--------|------|
| `mes.investment_casting_change_log` | mes 추가·수정·삭제 기록 (트리거) |
| `org.change_log` | org 추가·수정·삭제 기록 (트리거) |
| `lake.etl_watermark` | 작업별 처리 위치 (`mes_to_lake`, `org_to_lake`) |

### `ai` (판정·라벨·모델) — `11`·`14`

| 구분 | 테이블 | 핵심 |
|------|--------|------|
| 모델 | `model_registry` | PK (`model_name`, `version`). `process_code` = `CAST-QC1`(품질 1차 ML) / `CAST-QC2`(품질 2차 DL) / `SAFE-PPE`(보호구). 공정당 배포 1개 (트리거로 기존 배포 해제). `model_registry_idx` 자동 증가 없음 |
| 성과지표 | `model_metric_cast_qc1` (PR-AUC·recall·precision·f1), `model_metric_cast_qc2` (accuracy·recall·precision·f1), `model_metric_safe_ppe` (mAP50·recall·precision·f1) | FK → `model_registry`, ON DELETE CASCADE |
| 강건성 | `model_robustness` | PK (`model_name`, `version`, `condition_name`). 조건별 accuracy·recall·precision·f1 |
| 품질 판정 (1차·2차) | `quality_prediction` | PK `casting_id` (샷 1줄). 1차 `qc1_result` pass/fail·`qc1_score` 0~1 / 2차 `result`·`confidence_score` (1차 불량이면 비어 있음). 두 모델 모두 FK → `model_registry` |
| 이미지 후보 | `quality_image_pool` | 2차 검사 랜덤 매칭용. 매칭되면 `matched_casting_id` |
| 라벨 | `defect_label` (유형별 boolean 1개 이상: blowhole 기공·edge_burr 버·surface_rough 표면), `defect_discard` (판정 불가) | PK `casting_id`. 한 샷은 둘 중 한 곳만 |
| 보호구 | `ppe_gate_rule` (게이트별 필수 보호구), `ppe_check` (검사 기록) | `ppe_check` 는 `org.employee_gate_log` 또는 `org.vendor_gate_log` 중 하나만 참조 |
| LLM | `llm_feedback` | LLM 분석 결과 저장 (용도 협의 중) |

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
| `11_ai.sql` | schema `ai`: `defect_label`·`defect_discard` / `model_registry` + 공정별 지표 `model_metric_cast_qc1`·`_cast_qc2`·`_safe_ppe` / `ppe_gate_rule`·`ppe_check` |
| `12_lake_sync.sql` | lake 자동 갱신 준비: `mes` 변경 기록, `lake.etl_watermark`, lake 의 org 복사본 26개(`employee_info`·`hr_access_log`·`change_log` 제외) + 첫 전체 복사. 매일 갱신은 `MS/db/spark/jobs/lake_sync.py` + `MS/db/apps/src/apps/lake_runner.py` |
| `13_casting_image.sql` | `mes.casting_image`, `lake.lake_casting_image` (DH 이미지 파이프라인) |
| `14_품질_ai_추가.sql` | `org.fixed_value`, `ai.quality_prediction`·`model_robustness`·`quality_image_pool`·`llm_feedback` |
| `15_사내문서함.sql` | `org.company_document`, `org.document_chunk` |
| `16_모델관리_권한_시스템개발부만.sql` | `org.model_management_page` 를 시스템개발부만으로 교체 (read 전원, edit 과장 이상, 소장·부서장 공통 규칙 제외). **개발부 인원·직급이 바뀌면 다시 실행** (트리거 아님) |
| `17_app_ai_계정.sql` | 계정 `app_ai` 생성 + 모델·라벨 테이블 권한. 실행: `psql -v ai_pw=…` |
| `18_app_ai_권한추가.sql` | `app_ai` 에 `model_robustness`·`quality_prediction` 권한 추가 |
| `19_사내문서함_임베딩.sql` | `org.document_chunk_embedding`·`document_chunk_job` + 계정 `app_docs` (DH 서버 반영분 편입). 실행: `psql -v docs_pw=…` |
| `20_경영리포트_고정값.sql` | `org.fixed_value` 에 경영 리포트 고정값 5행 (재활용_회수액·재활용률·MTTR·MTBF·리콜_횟수_12개월) |
| `21_경영리포트_SPC_불량유형.sql` | `mes.spc_limit` (라인·변수별 CL·σ·I·MR·EWMA 한계, 날짜별 이력, JH `spc.py` 값 39행) |
| `22_품질1차_모델등록.sql` | 품질 1차(CAST-QC1) 모델 56개 등록 + 지표 (TM 정리표 model_summary). 배포 `DieCasting_XGB_20261114_09`/`v17.2`. 파일은 저장소 `TM/model_ml/` (`file_path` = 저장소 기준 경로) |
| `23_품질판정_1차칸추가.sql` | `ai.quality_prediction` 에 1차(ML) 칸 `qc1_*` 추가, 기존 2차 칸은 비어 있을 수 있게 (1차 불량이면 2차 없음) |
| `24_보호구_모델등록.sql` | `ai.model_metric_safe_ppe.accuracy_score` → `map50_score`, 보호구 모델 4개 (`PPE_YOLO26*_20261118_01~04` / v1.1~v1.4) 등록, 배포 v1.4 |
| `25_보호구_게이트기록.sql` | `ai.ppe_check.manual_at` (안전관리자 태깅 시각), 위반 건도 안전관리자 확인 기록 허용, 지난 알람 목업에 안전관리자 확인 채움, 출입 로그·판정 번호 자동 증가 (게이트 프로그램용) |
| `27_주조이미지_경로라벨.sql` | `mes.casting_image` 에 `image_path` (서버 jpg 경로 `/root/images/L1/yymmdd/<casting_id>.jpg`)·`image_label` (ok/defect) 추가. `image_base64` 는 그대로 (JH 2차 검사용). 서버 적용 완료 |
| `28_알루미늄_시세.sql` | `org.aluminum_price` (일자 `price_date`, 가격 `price` US$/톤). LME 시세 중 알루미늄만, 빈 테이블 |
| `29_보호구_판정사진.sql` | `ai.ppe_check_image` (판정번호 PK·FK, `image_path`, `detected_count` 0~5, `score`). 판정 1건 = 사진 1장. 쓰기 `app_mes`(사진 받기 API) |
| `30_품질2차_모델추가.sql` | 품질 2차 모델 `DieCasting_CNXV2T_20261117_02~04` (v1.1~v1.3) 등록·지표·강건성 14개씩. 배포 안 함 (`_01` 유지) |
| `31_로그인계정.sql` | `org.app_user` (웹 로그인 계정). 쓰기 `app_hr`, lake·spark 권한 없음 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-11-21 | `31`: `org.app_user` 신설 (JH 요청, 임시 SQLite 대체). 사번 1:1·사원 삭제 시 함께 삭제. 이메일 칸 없음 → `employee_info.email` 하나로 통일. `app_hr` 재사용, lake 복사 안 함 |
| 2026-11-21 | `30`: 품질 2차 모델 3개 등록 (배포 안 함) |
| 2026-11-20 | `29`: `ai.ppe_check_image` 신설 — 보호구 판정 사진 (게이트 → Kafka `aiax.ppe.frame` → Flink `ppe_frame_select` → 사진 받기 API `/api/images/ppe/<판정번호>`). 중요한 장면 = 보호구 5개 다 잡힌 화면 중 신뢰도 합 최고 |
| 2026-11-20 | `28`: `org.aluminum_price` 신설 (알루미늄 현물 시세, 일자·가격). 데이터는 나중에 |
| 2026-11-20 | `27`: 주조 이미지 서버 파일 저장 준비 — `image_path`·`image_label`. Flink `image_ingest` 는 `.env` `IMAGE_API_KEY` 가 있으면 서버 이미지 API(`https://gknushift.freemyip.com/api/images`, POST, `X-API-Key`)로 보내고, 없으면 예전처럼 DB 직접 저장 |
| 2026-11-20 | `11`: `ai.model_metric_safe_ppe` 를 처음부터 `map50_score` 로 (서버와 같게, JH 요청). 24 의 이름 변경은 칸이 있을 때만 해서 함께 써도 됨 |
| 2026-11-20 | `25`: 보호구 게이트 실기록 준비 — `manual_at` 추가, 확인 기록을 위반·판정 불가 모두 허용(통과 제외, 3칸 함께), `employee_gate_log`·`vendor_gate_log`·`ppe_check` 번호 시퀀스. 목업: 지난 위반·판정 불가에 안전부 확인(2~10분 뒤, 위반 약 8% 오판) 채움, 미래 시각 목업은 그대로 |
| 2026-11-20 | `24`: 보호구 지표를 mAP50 으로 (`map50_score`), 모델 4개 등록·`PPE_YOLO26s_20261118_04`/`v1.4` 배포. 파일은 저장소 밖 `D:\cas_image\ppe` |
| 2026-11-20 | `23`: `ai.quality_prediction` = 샷 1줄에 1차·2차 결과 (1차 `qc1_model_name`·`qc1_version`·`qc1_result`·`qc1_score`·`qc1_predicted_at` 추가). 리포트 1차 불량 수용 |
| 2026-11-20 | `22`: 품질 1차 모델 56개 등록 (TM 정리표), 배포 `DieCasting_XGB_20261114_09`/`v17.2` (처음 넣은 `v1` 교체). `XGB_20261109_25` 는 파일 없음, `XGB_20261107_01` 은 정리표에 없어 미등록 |
| 2026-11-20 | `21`: `mes.spc_limit` 신설 + JH `spc.py` 관리도 기준선 39행 옮김 (리포트 SPC 경고용) (불량 유형 미성형·크랙 칼럼은 추가했다가 리포트에서 불량 유형을 빼기로 해 같은 날 삭제) |
| 2026-11-20 | DH: `org.process_alert_daily_notice` (메인 전날 알람 AI 공지 캐시) — SQL `DH/data/sql/06_…`, MS init 편입 요청 |
| 2026-11-20 | `20`: 경영 관리자 리포트 고정값 5행을 `org.fixed_value` 에 추가 (JH 코드에 박혀 있던 값, 재활용률은 신규) |
| 2026-11-19 | `19`: DH 가 서버에 만든 `org.document_chunk_embedding`·`document_chunk_job`, 계정 `app_docs` 를 init 에 편입 (서버 권한 확인 일치) |
| 2026-11-19 | **주조 데이터 전체 교체** (새 CSV 3개, 요청 반영): mes 134,007 → **118,901** (line_no1 96,256 / line_no2 11,316 / line_no3 11,329, 세 라인 모두 ~2026-11-20). lake 동일하게 재생성, mart 57,295 (같은 범위) 재생성. 테스트 이미지 5장 삭제. 백업: MS PC `D:\AIAX_data\backup\*_20261119_213719.csv`. 실행: `MS/db/apps/src/apps/reload_casting.py` |
| 2026-11-19 | **`casting_id` 규칙 변경**: `L라인번호_` 추가 (`init/03`, `08_data.sql.gz` 의 lake·mart 번호도 `L1_` 로). Flink `image_ingest.py` 형식 검사 수정. DH `payload.py` 형식 검사 수정 요청 |
| 2026-11-19 | `lake_sync.py` 접속 버그 수정 (`--packages` 드라이버를 DriverManager 가 못 찾음 → 드라이버 직접 사용). MS PC 에서 첫 실행 성공 (org 1.46만 건 반영) |
| 2026-11-19 | 문서 정리: 「어디에 무엇이 있나」·복사본 갱신 상태 추가, 계정 표에 `ai` 열·`app_ai` 추가, `ai`·이미지·변경 기록 테이블 절 추가, init 13~18 반영 |
| 2026-11-19 | `18`: `app_ai` 에 `model_robustness`(SELECT·INSERT·DELETE)·`quality_prediction`(SELECT·INSERT·UPDATE) 권한 (JH 요청). 서버 적용 |
| 2026-11-19 | `17`: 계정 `app_ai` (JH 요청, 모델 등록·라벨 저장용). `16`: 모델 관리 페이지 권한 시스템개발부 전용 |
| 2026-11-19 | `15`: `org.company_document`·`document_chunk` (사내 문서함). `14`: `org.fixed_value`, `ai.quality_prediction`·`model_robustness`·`quality_image_pool`·`llm_feedback` |
| 2026-11-19 | `13`: `mes.casting_image`·`lake.lake_casting_image` (DH 요청, 이미지 파이프라인). `11`: 공정 코드 `CAST-QC1`·`CAST-QC2`·`SAFE-PPE`, 지표를 공정별 테이블로 분리 (서버는 11-18 적용) |
| 2026-11-19 | 품질 2차 모델 `DieCasting_CNXV2T_20261117_01`/`v1` 등록·배포 + 지표 + 강건성 14행 (JH SQL, 관리자 실행) |
| 2026-11-18 | lake 의 org 복사본을 새 구조 26개로 재생성 (옛 23개 삭제), `etl_watermark` 재설정. Spark 작업·00:00 KST 실행기 코드 추가 (서버 Spark 설치 전) |
| 2026-11-18 | `ai.ppe_gate_rule`·`ai.ppe_check` (보호구 착용 위반 대시보드). 목업 2,756건 |
| 2026-11-18 | `ai.model_registry` (모델 레지스트리, DH 요청). 파일 저장 경로는 서버 관리자가 정함 |
| 2026-11-18 | schema `ai` 신설 + `defect_label`·`defect_discard` (불량 유형 라벨링). 읽기: role_lake·role_spark, 쓰기 계정은 담당 확정 후 |
| 2026-11-18 | 페이지 `worker_safety` → `ppe_violation`(보호구 착용 위반 대시보드), 권한 테이블 `ppe_violation_page` |
| 2026-11-18 | `org.employee` 재직 상태(`employment_status`, `resigned_at`) + 퇴사 트리거. 인사 관리 열람 = 사원 이상 |
| 2026-11-17 | `org` 새 구조 (MS): 코드 숫자화·일련번호, `vender`→`vendor`, `age`→`birth_date`, 페이지 권한 9개(접근 코드 기준), 트리거(접근 코드·명단·근태), `app_hr` 계정 init 반영. 서버 적용 완료 |
| 2026-11-16 | schema `org` (DH). init 09/10. `app_lake` SELECT. DB 서술 → `DB연동_내역`. SQLite·MS DB 장문 정리 |
| 2026-11-10 | 현행 init 기준으로 루트 문서 신설. 계정 `shift` / `app_mes`·`app_spark`·`app_mart`·`app_lake`. 지속 갱신 의무 명시 |
| 2026-11-10 | `app_lake` vs 스키마 `lake` 혼동 주의 절 추가 |
