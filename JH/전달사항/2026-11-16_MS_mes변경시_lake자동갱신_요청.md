# 전달사항 — mes 변경 시 Spark 자동 실행으로 lake 갱신 (JH → MS)

- 작성: JH, 2026-11-16
- 대상: MS (DB 스키마 `MS/db/init/` · Spark 작업 `MS/db/spark/jobs/` · 앱 `MS/db/apps/`)
- 상태: **① 변경 기록 · 첫 전체 복제 NCP DB 적용 완료 (2026-11-16, DH·MS 승인)** — 적용 SQL: [`sql/2026-11-16_lake_sync_setup.sql`](sql/2026-11-16_lake_sync_setup.sql)
  - 남은 일 (MS): ② 00:00 KST 실행기 · ③ Spark 작업 · 위 SQL을 `MS/db/init/`에 반영 · 루트 `DB구조.md` 갱신
  - 적용 시 기본값: `employee_info`(개인정보) 복제 제외, 기존 `lake.lake_investment_casting` 외래키 변경 없음 (mes 행 삭제는 여전히 막힘)

## 1. 요청 내용

1. `mes.investment_casting` 데이터의 **추가·수정·삭제를 빠짐없이 기록**하고
2. **매일 한국 시간(KST, Asia/Seoul) 00:00에 Spark 정제 작업을 자동 실행**하여
3. 전날 00:00 이후 바뀐 내용을 `lake.lake_investment_casting`에 반영 (정제 규칙 적용) 해 주세요.
4. 처음 1회는 mes **전체**를 읽어 lake 전체를 맞춥니다 (전체 동기화).

> 2026-11-16 결정: 변경 즉시 실행이 아니라 **하루 1번 00:00 KST 일괄 반영**. lake는 "전날 자정 기준" 데이터.

## 2. 현재 상태 (2026-11-16, NCP `aiax` 읽기 전용 조회로 확인)

| 항목 | 상태 |
|------|------|
| `mes.investment_casting` | 73,612행, 24칼럼 (원본) |
| `lake.lake_investment_casting` | 73,612행, 21칼럼 (`line_unit`·`production`·`production_count` 제외). **덤프(08_data.sql.gz)로 적재된 값** |
| 변경 감지 장치 (트리거·로그·NOTIFY) | 없음 |
| Spark 작업 코드 | 없음 (`MS/db/spark/jobs/` 비어 있음) |
| lake → mes 외래키 | `REFERENCES mes.investment_casting(casting_id)` — **ON DELETE 규칙 없음 → mes 행 삭제가 막힘** |
| Spark 위치 | MS 로컬 Docker만. NCP에는 Postgres만 있음 |

→ 지금은 mes가 바뀌어도 lake는 바뀌지 않습니다.

## 3. 제안 구조

```text
 mes.investment_casting  ──(① 트리거: 행마다 변경 기록, 하루 종일)──▶ mes.investment_casting_change_log
                                                                              │
 ② 실행기 (MS/db/apps, Python 상주) ── 매일 00:00 KST ───────────────────────┘
        │  spark-submit (동시에 1개만)
        ▼
 ③ Spark 작업 mes_to_lake.py (MS 작성 예정)
        │  워터마크 이후 변경분만 읽음 → 정제 → 임시 테이블 → upsert/delete → 워터마크 갱신 (한 트랜잭션)
        ▼
 lake.lake_investment_casting   (전날 00:00 ~ 당일 00:00 변경분 반영)
```

| 구성 | 역할 | 위치(제안) |
|------|------|------------|
| ① 변경 기록 트리거 | mes 변경을 놓치지 않고 기록 (실행기·Spark가 멈춰 있어도 기록은 남음) | `MS/db/init/11_mes_change_capture.sql` |
| ② 실행기 | 매일 00:00 KST에 Spark 작업 실행. 놓친 날은 시작 시 따라잡기 | `MS/db/apps/src/apps/mes_lake_runner.py` |
| ③ Spark 작업 | 변경분만 정제해서 lake에 반영 (증분). 처음에는 전체 | `MS/db/spark/jobs/mes_to_lake.py` |

**왜 트리거가 Spark를 직접 실행하지 않나:** DB 트리거 안에서는 외부 프로그램을 실행할 수 없습니다. 그래서 **DB(트리거)는 하루 종일 변경을 기록만** 하고, **실행기가 00:00 KST에 하루치를 한 번에** Spark로 반영합니다. 하루 중 변경은 다음 날 00:00에 lake에 나타납니다.

## 4. ① 변경 기록 — SQL 초안 (이름은 명명규칙에 맞춰 조정)

```sql
-- 변경 기록 (Spark가 어디까지 처리했는지는 change_id로 판단)
CREATE TABLE mes.investment_casting_change_log (
    change_id   bigserial   PRIMARY KEY,
    casting_id  text        NOT NULL,
    op          char(1)     NOT NULL CHECK (op IN ('I', 'U', 'D')),
    changed_at  timestamptz NOT NULL DEFAULT now()
);

-- 행마다: 무엇이 바뀌었는지 기록
CREATE FUNCTION mes.log_investment_casting_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (NEW.casting_id, 'I');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (OLD.casting_id, 'D');
  ELSIF NEW.casting_id IS DISTINCT FROM OLD.casting_id THEN
    -- casting_id는 날짜·시각·생산번호로 자동 생성 → 이 값이 바뀌면 "옛 키 삭제 + 새 키 추가"
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (OLD.casting_id, 'D'), (NEW.casting_id, 'I');
  ELSE
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (NEW.casting_id, 'U');
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_investment_casting_change_row
AFTER INSERT OR UPDATE OR DELETE ON mes.investment_casting
FOR EACH ROW EXECUTE FUNCTION mes.log_investment_casting_change();
-- (00:00 일괄 실행이므로 즉시 알림(pg_notify)은 두지 않음)

-- Spark가 처리한 위치 (워터마크)
CREATE TABLE lake.etl_watermark (
    job_name        text        PRIMARY KEY,
    last_change_id  bigint      NOT NULL DEFAULT 0,
    last_run_at     timestamptz
);
INSERT INTO lake.etl_watermark (job_name) VALUES ('mes_to_lake');
```

**외래키 결정 필요:** 지금 lake → mes 외래키 때문에 mes 행을 삭제할 수 없습니다. 둘 중 하나를 정해 주세요.

| 안 | 내용 | 비고 |
|----|------|------|
| A (추천) | 외래키 유지 + `ON DELETE CASCADE` | mes 삭제 시 lake도 즉시 삭제. Spark의 삭제 처리는 "이미 없음"으로 통과 |
| B | 외래키 제거 | 삭제도 Spark가 반영 (수십 초 지연 동안 lake에 고아 행 존재) |

**권한(06_grants.sql):** `role_spark`에 `mes.investment_casting_change_log` SELECT, `lake.etl_watermark` SELECT·UPDATE. 실행기는 `role_spark` 사용 가능.

## 5. ② 실행기 — 동작 규칙 (00:00 KST)

1. 실행 시각: **매일 00:00, 시간대 `Asia/Seoul` 명시.** 서버 시계가 UTC여도 KST 기준으로 계산 (00:00 KST = 전날 15:00 UTC). 한국은 서머타임이 없어 연중 동일.
   - cron을 쓰면 `CRON_TZ=Asia/Seoul` + `0 0 * * *`, Python 상주면 `zoneinfo.ZoneInfo('Asia/Seoul')`로 다음 자정 계산.
2. 실행 범위: 워터마크 이후 ~ **실행 시점에 고정한 최대 change_id**까지. 00:00 직후 들어온 변경은 다음 날 몫.
3. **따라잡기:** 실행기·장비가 꺼져 있어 00:00를 놓쳤다면, 시작할 때 `lake.etl_watermark.last_run_at`이 오늘 00:00 KST보다 이전이고 미처리 변경이 있으면 **즉시 1번 실행**. (변경 기록은 남아 있으므로 하루 이상 밀려도 한 번에 반영)
4. 변경이 없으면(`max(change_id) = last_change_id`) Spark를 띄우지 않고 "변경 없음"만 기록.
5. 실행 중이면 새로 띄우지 않음 — `pg_try_advisory_lock` 으로 1개만 실행.
6. Spark 실행 결과(시작·종료 시각 KST, 성공·실패, 처리 행 수)를 로그로 남김 (`MS/로그_기록.md` 분류 대상). 실패 시 워터마크는 그대로 → 다음 00:00 또는 수동 재실행 때 같은 범위 재처리.
7. DB 연결은 실행할 때만 열고 끝나면 닫기 (AGENTS.md 4항).
8. 수동 실행 명령도 제공 (`uv run python -m apps.mes_lake_runner --now`) — 첫 전체 동기화·장애 복구용.

## 6. ③ Spark 작업 — 처리 규칙 (MS 작성 예정)

| 단계 | 내용 |
|------|------|
| 1 | `lake.etl_watermark`에서 `last_change_id`(W) 읽기, `change_log`의 현재 최대값(M) 고정 |
| 2 | `W < change_id ≤ M` 변경분을 `casting_id`별로 **마지막 op만** 남김 |
| 3 | I/U 대상 `casting_id`의 mes 행을 JDBC로 읽음 (W=0이면 mes **전체** = 첫 전체 동기화) |
| 4 | 정제 규칙 적용 — 현재는 3칼럼 제외. 결측·이상치 규칙이 생기면 여기에 추가 |
| 5 | 결과를 임시 테이블 `lake.stg_lake_investment_casting`에 덮어쓰기 (JDBC는 upsert를 못 함) |
| 6 | **한 트랜잭션**으로: 임시 → 본 테이블 `INSERT … ON CONFLICT (casting_id) DO UPDATE`, D 대상 `DELETE`, 워터마크를 M으로 갱신 |
| 7 | 여러 번 다시 실행해도 결과가 같아야 함 (중간 실패 시 워터마크가 안 바뀌므로 다음 실행이 같은 범위를 다시 처리) |

## 7. 확인 방법 (테스트 DB에서)

(00:00까지 기다리지 않도록 `--now` 수동 실행으로 확인)

1. 전체 동기화: 워터마크 0 → 실행 → `lake` 행 수 = `mes` 행 수, 무작위 100행 값 비교 일치
2. 추가: mes에 1행 INSERT → 실행 전 lake에 없음 → 실행 후 생김
3. 수정: mes 센서 값 UPDATE → 실행 후 lake 값 바뀜
4. 키 변경: mes `date` UPDATE → lake에 옛 `casting_id` 없음, 새 `casting_id` 있음
5. 삭제: mes DELETE → 실행 후(외래키 A안이면 즉시) lake에서 사라짐
6. 같은 행을 하루에 여러 번 수정 → 실행 후 마지막 값만 반영
7. 실행기 중지 → 변경 → 00:00 지난 뒤 재시작 → 시작 즉시 밀린 변경 반영 (따라잡기)
8. 시간대: 서버 시간대를 UTC로 둔 상태에서 다음 실행 예정 시각이 15:00 UTC(= 00:00 KST)로 계산되는지 확인

## 8. 함께 갱신할 문서 (MS)

- 루트 `DB구조.md` — 변경 기록·워터마크·임시 테이블, 외래키 규칙, 변경 이력
- `MS/db/README.md` — 실행기 실행 방법, 데이터 흐름 그림
- `DB연동_내역/` — 연동 기록
- 실행 위치 결정: Spark가 NCP에 없으므로 **실행기·Spark를 어느 장비에서 띄울지** (NCP DB 5432 방화벽 허용 IP 포함)

## 8-1. 추가 요청 — 다른 테이블(org 스키마 24개)도 lake에 복제·자동 갱신 (2026-11-16)

> 대상 DB에서 mes 외 테이블은 **org 스키마(DH 소유) 24개뿐** (mart는 lake의 하류라 제외). DH·MS 협의 필요.

### 규칙
- 이름: `org.<테이블>` → `lake.lake_<테이블>` (예: `org.employee` → `lake.lake_employee`, `org."position"` → `lake.lake_position`)
- 칼럼: 원본과 **동일** (org는 정제 규칙 없음 — 생기면 Spark 작업에 추가)
- **동기화 키: 모든 org 테이블에 있는 `<테이블>_idx` (UNIQUE NOT NULL)** — PK가 없는 테이블 6개(아래 ✱)도 이 칼럼으로 처리 가능
- 갱신: mes와 같은 구조 — ① 변경 기록 트리거 → ② **00:00 KST** 실행기 → ③ Spark 작업 (테이블 목록만 늘림)

### 대상 (2026-11-16 NCP 기준 행 수)

| org 테이블 | lake 테이블 | 키 | 행 | 비고 |
|------------|-------------|----|----|------|
| position | lake_position | position_idx | 7 | |
| department | lake_department | department_idx | 7 | |
| team | lake_team | team_idx | 6 | |
| employee | lake_employee | employee_idx | 53 | |
| employee_info | lake_employee_info | employee_info_idx | 53 | ⚠ **개인정보**(이름·나이·성별·전화·주소·이메일) — 아래 결정 필요 |
| employee_status | lake_employee_status | employee_status_idx | 5 | |
| employee_card | lake_employee_card | employee_card_idx | 5 | |
| attendance | lake_attendance | attendance_idx | 5 | |
| access_code | lake_access_code | access_code_idx | 53 | |
| page | lake_page | page_idx | 6 | |
| main_page / model_management_page / process_optimization_page / quality_inspection_page / worker_safety_page / management_report_page | lake_<각 이름> | <각 이름>_idx | 각 5 | 페이지 권한 6종 |
| dept_roster ✱ | lake_dept_roster | dept_roster_idx | 53 | PK 없음 |
| team_roster ✱ | lake_team_roster | team_roster_idx | 53 | PK 없음 |
| employee_gate_log ✱ | lake_employee_gate_log | employee_gate_log_idx | 5 | PK 없음 |
| employee_record ✱ | lake_employee_record | employee_record_idx | 5 | PK 없음 |
| gate_card ✱ | lake_gate_card | gate_card_idx | 5 | PK 없음 |
| vender_company | lake_vender_company | vender_company_idx | 2 | |
| vender_worker | lake_vender_worker | vender_worker_idx | 5 | |
| vender_gate_log ✱ | lake_vender_gate_log | vender_gate_log_idx | 5 | PK 없음 |

### 변경 기록 — 공용 트리거 1개로 전 테이블 처리 (SQL 초안)

```sql
-- mes 전용 기록(4절)과 별도로, org 공용 기록 1개
CREATE TABLE org.change_log (
    change_id   bigserial   PRIMARY KEY,
    table_name  text        NOT NULL,        -- 예: 'employee'
    row_idx     integer     NOT NULL,        -- <table>_idx 값
    op          char(1)     NOT NULL CHECK (op IN ('I', 'U', 'D')),
    changed_at  timestamptz NOT NULL DEFAULT now()
);

-- 키 칼럼명 = 테이블명 || '_idx' (org 전 테이블 공통 규칙)
CREATE FUNCTION org.log_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  k text := TG_TABLE_NAME || '_idx';
  old_k integer; new_k integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_k := (to_jsonb(OLD) ->> k)::integer; END IF;
  IF TG_OP <> 'DELETE' THEN new_k := (to_jsonb(NEW) ->> k)::integer; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO org.change_log (table_name, row_idx, op) VALUES (TG_TABLE_NAME, new_k, 'I');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO org.change_log (table_name, row_idx, op) VALUES (TG_TABLE_NAME, old_k, 'D');
  ELSIF new_k IS DISTINCT FROM old_k THEN
    INSERT INTO org.change_log (table_name, row_idx, op) VALUES (TG_TABLE_NAME, old_k, 'D'), (TG_TABLE_NAME, new_k, 'I');
  ELSE
    INSERT INTO org.change_log (table_name, row_idx, op) VALUES (TG_TABLE_NAME, new_k, 'U');
  END IF;
  RETURN NULL;
END $$;

-- 24개 테이블에 같은 트리거 부착 (change_log 자신은 제외)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'org' AND c.relkind = 'r' AND c.relname <> 'change_log'
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_change AFTER INSERT OR UPDATE OR DELETE ON org.%I
                    FOR EACH ROW EXECUTE FUNCTION org.log_change()', t, t);
  END LOOP;
END $$;

-- 워터마크: 4절 lake.etl_watermark 에 1행 추가
INSERT INTO lake.etl_watermark (job_name) VALUES ('org_to_lake');
```

- lake 테이블 24개는 원본과 같은 칼럼으로 생성 (`CREATE TABLE lake.lake_<t> (LIKE org.<t> INCLUDING DEFAULTS)` + `<t>_idx` PRIMARY KEY). 원본 외래키는 lake에 복제하지 않음 (갱신 순서 문제 방지).
- 새 org 테이블이 생기면 트리거·lake 테이블·Spark 목록에 같이 추가 (규칙 동일).

### Spark 작업 — mes 작업과 같은 7단계, 테이블 목록만 반복
- `org.change_log`에서 워터마크 이후 변경을 `(table_name, row_idx)`별 마지막 op로 정리 → 테이블마다 원본 행 읽기 → 임시 테이블 → upsert/delete → 워터마크 갱신 (한 트랜잭션).
- 첫 실행(워터마크 0)은 24개 테이블 **전체 복제**.

### 결정 필요 (DH·MS)
1. **`employee_info`(개인정보) 복제 여부** — 추천: **복제하지 않음** 또는 이름·전화·주소·이메일을 뺀 `employee_no`·`age`·`gender`만. lake는 Spark·조회 계정이 넓게 읽는 영역이라 개인정보 사본이 늘면 유출 범위가 커짐.
2. org는 DH 소유 스키마 → 트리거 부착 승인 (DH) / lake 테이블·Spark·실행기 (MS).
3. `role_spark` 권한: `org` USAGE + 대상 테이블·`org.change_log` SELECT.

## 9. JH 쪽 영향

- JH 화면(API 연결 시)은 **lake를 읽을 예정**. lake는 하루 1번(00:00 KST) 갱신이므로 화면에 "기준: YYYY-MM-DD 00:00" 표시.
- 당일 실시간 샷이 필요한 화면(공정 최적화·품질 검사)은 lake가 아니라 mes(또는 실시간 경로)를 읽어야 함 — API 설계 때 결정.
- JH는 이 작업과 관련해 DB·MS 폴더를 수정하지 않습니다.
