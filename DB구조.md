# AIAX PostgreSQL 구조 (현행)

| 항목 | 내용 |
|------|------|
| DB 이름 | `aiax` |
| 근거 코드 | [`MS/db/init/`](MS/db/init/) |
| 명명 규칙 | [`MS/db/명명규칙.md`](MS/db/명명규칙.md) |
| 최종 반영일 | 2026-11-10 |

---

## 필수: 수정 시 이 문서를 같이 갱신

**스키마·테이블·컬럼·제약·계정을 바꾸면 반드시 이 파일(`DB구조.md`)을 같은 PR/작업에서 업데이트한다.**

| 담당 | 할 일 |
|------|--------|
| **MS** | `MS/db/init/`·스키마 변경의 **주 담당**. 변경 시 본 문서 + [`MS/db/README.md`](MS/db/README.md) 계정/구조 언급을 맞춤 |
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

관계: `mes` →(FK)·`lake` →(FK)·`mart` (`casting_id`).

---

## 계정 (로그인)

| 계정 | 용도 | mes | lake | mart |
|------|------|-----|------|------|
| `shift` | 관리 (`POSTGRES_USER`) | 전체 | 전체 | 전체 |
| `app_mes` | 원본 적재 | 읽기·쓰기(삭제 불가) | - | - |
| `app_spark` | 배치 | 읽기 | 읽기·쓰기 | 읽기·쓰기 |
| `app_mart` | 학습 읽기 | - | - | 읽기 |
| `app_lake` | 조회 (DH 등) | 읽기 | 읽기 | 읽기 |

권한 그룹: `role_mes`, `role_spark`, `role_mart`, `role_lake`.

### 이름 혼동 주의 (`app_lake` ≠ 스키마 `lake`만)

| 이름 | 무엇인가 | 자주 하는 오해 |
|------|----------|----------------|
| **스키마 `lake`** | 정제 데이터가 들어가는 **칸막이** | — |
| **계정 `app_lake`** | DH 등 **조회 전용 로그인** (구 readonly) | “lake 스키마만 다룬다” |

`app_lake`는 스키마 `lake` 전용 계정이 **아니다**.  
권한은 **`mes` / `lake` / `mart` 전부 SELECT** 이다. (쓰기·적재는 `app_mes`·`app_spark` 등)

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

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-11-10 | 현행 init 기준으로 루트 문서 신설. 계정 `shift` / `app_mes`·`app_spark`·`app_mart`·`app_lake`. 지속 갱신 의무 명시 |
| 2026-11-10 | `app_lake` vs 스키마 `lake` 혼동 주의 절 추가 |
