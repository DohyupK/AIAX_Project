-- =====================================================================
-- 09 schema org (조직·권한·하청·게이트·근태) — 2026-11-17 새 구조 (MS)
-- 서버(aiax) 적용: 2026-11-17. 설명서: MS/전달사항/2026-11-17_org_새구조/
-- 구조 문서: DB구조.md · DB연동_내역/조직권한_테이블구조.md
-- org 스키마를 통째로 지우고 다시 만든다 (최초 기동 시에는 지울 것 없음).
-- 목업 데이터는 10_org_permission_seed.sql
-- =====================================================================

BEGIN;

DROP SCHEMA IF EXISTS org CASCADE;
CREATE SCHEMA org;
COMMENT ON SCHEMA org IS '조직·권한·하청·게이트·근태';

-- ---------------------------------------------------------------------
-- 1. 마스터
-- ---------------------------------------------------------------------

-- 직급
CREATE TABLE org."position" (
    position_idx   integer     NOT NULL UNIQUE,
    position_name  text        PRIMARY KEY,
    position_code  integer     NOT NULL UNIQUE,      -- 10000 인턴 ~ 70000 소장 (접근 코드 만의 자리)
    created_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org."position" IS '직급';

-- 부서
CREATE TABLE org.department (
    department_idx             integer     NOT NULL UNIQUE,
    dept_name                  text        NOT NULL UNIQUE,
    dept_code                  integer     PRIMARY KEY,  -- 1000 경영 ~ 7000 R&D (천의 자리)
    department_representative  text,                     -- 부서장 사번 (FK는 employee 생성 뒤)
    created_at                 timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.department IS '부서. 부서장은 department_representative 가 원본';

-- 팀
CREATE TABLE org.team (
    team_idx             integer     NOT NULL UNIQUE,
    team_name            text        NOT NULL UNIQUE,   -- casting1 … tf
    team_code            integer     PRIMARY KEY,       -- 10 ~ 60 (십의 자리). 팀 없음은 사원 team_code = NULL (접근 코드 0)
    team_representative  text,                          -- 팀장 사번 (FK는 employee 생성 뒤)
    created_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.team IS '팀. 팀장은 team_representative 가 원본';

-- 페이지 (행 순서 = 사이드바 순서)
CREATE TABLE org.page (
    page_idx    integer     NOT NULL UNIQUE,
    page_name   text        NOT NULL,                 -- 사이드바 표시명
    page_code   text        PRIMARY KEY,              -- page_registry id
    created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.page IS '페이지. page_idx = 사이드바 순서';

-- 하청업체
CREATE TABLE org.vendor_company (
    vendor_company_idx  integer     NOT NULL UNIQUE,
    vendor_name         text        NOT NULL,
    vendor_code         text        PRIMARY KEY,      -- v0001 ~
    contract_status     text        NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.vendor_company IS '하청업체';

-- ---------------------------------------------------------------------
-- 2. 사원
-- ---------------------------------------------------------------------

CREATE TABLE org.employee (
    employee_idx   integer     NOT NULL UNIQUE,
    employee_no    text        PRIMARY KEY,                                  -- e0001 ~ (부서와 무관한 일련번호)
    dept_code      integer     NOT NULL REFERENCES org.department(dept_code),
    position_name  text        NOT NULL REFERENCES org."position"(position_name),
    team_code      integer     REFERENCES org.team(team_code),               -- NULL = 팀 없음
    employment_status text     NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'resigned')),  -- 재직 / 퇴사
    resigned_at    date,                                                     -- 퇴사일 (재직이면 NULL)
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT employee_resigned_check CHECK (
        (employment_status = 'active'   AND resigned_at IS NULL) OR
        (employment_status = 'resigned' AND resigned_at IS NOT NULL))
);
COMMENT ON TABLE org.employee IS '사원. 직급·부서·팀이 바뀌면 트리거가 접근 코드·부서/팀 명단을 자동으로 맞춤';

ALTER TABLE org.department
    ADD CONSTRAINT department_representative_fkey
    FOREIGN KEY (department_representative) REFERENCES org.employee(employee_no);
ALTER TABLE org.team
    ADD CONSTRAINT team_representative_fkey
    FOREIGN KEY (team_representative) REFERENCES org.employee(employee_no);

CREATE TABLE org.employee_info (
    employee_info_idx  integer     NOT NULL UNIQUE,
    employee_no        text        PRIMARY KEY REFERENCES org.employee(employee_no),
    employee_name      text        NOT NULL,
    birth_date         date        NOT NULL,                                -- 나이는 조회할 때 계산
    gender             text        NOT NULL CHECK (gender IN ('M', 'F', 'other')),
    phone              text        NOT NULL,
    address            text        NOT NULL,
    email              text        NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN org.employee_info.birth_date IS '나이 = date_part(''year'', age(birth_date))';

CREATE TABLE org.employee_status (
    employee_status_idx    integer     NOT NULL UNIQUE,
    employee_no            text        PRIMARY KEY REFERENCES org.employee(employee_no),
    monthly_overtime_hour  double precision,
    last_logout_at         timestamptz,                                     -- 마지막 퇴근 시각
    annual_leave_used      integer CHECK (annual_leave_used IS NULL OR annual_leave_used BETWEEN 0 AND 15),  -- 결근 1일 = 1
    years_of_service       integer,
    created_at             timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.employee_status IS '사원 상태 요약. 출입·근무 기록에서 계산한 값';

-- 접근 코드 (트리거가 자동 계산)
CREATE TABLE org.access_code (
    access_code_idx  integer     NOT NULL UNIQUE,
    employee_no      text        PRIMARY KEY REFERENCES org.employee(employee_no),
    access_code      integer     NOT NULL,                                  -- 같은 코드 여러 명 가능
    created_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.access_code IS '접근 코드 = 직급 + 부서 + 부서장 100 + 팀 + 팀장 1. 트리거가 자동 계산';

-- 부서·팀 명단 (트리거가 employee 와 자동으로 맞춤)
CREATE TABLE org.dept_roster (
    dept_roster_idx  integer     NOT NULL UNIQUE,
    dept_code        integer     NOT NULL REFERENCES org.department(dept_code),
    employee_no      text        NOT NULL UNIQUE REFERENCES org.employee(employee_no),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE org.team_roster (
    team_roster_idx  integer     NOT NULL UNIQUE,
    team_code        integer     NOT NULL REFERENCES org.team(team_code),
    employee_no      text        NOT NULL UNIQUE REFERENCES org.employee(employee_no),
    created_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.team_roster IS '팀 없는 사원은 행 없음';

-- ---------------------------------------------------------------------
-- 3. 카드·게이트
-- ---------------------------------------------------------------------

CREATE TABLE org.employee_card (
    employee_card_idx  integer     NOT NULL UNIQUE,
    card_id            text        PRIMARY KEY,                             -- ec0001 ~
    employee_no        text        NOT NULL UNIQUE REFERENCES org.employee(employee_no),
    attendance_status  text        NOT NULL DEFAULT 'absent' CHECK (attendance_status IN ('present', 'absent')),
    created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN org.employee_card.attendance_status IS '현재 회사 안(present)/밖(absent). 출입 로그 IN/OUT 으로 트리거가 맞춤';

CREATE TABLE org.vendor_worker (
    vendor_worker_idx  integer     NOT NULL UNIQUE,
    vendor_code        text        NOT NULL REFERENCES org.vendor_company(vendor_code),
    card_id            text        PRIMARY KEY,                             -- vc0001 ~ (작업자 이름 없음)
    card_issued_at     timestamptz NOT NULL,
    card_returned_at   timestamptz,                                         -- NULL = 사용 중
    created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.vendor_worker IS '하청 출입 카드. 게이트는 gate_card 에만';

CREATE TABLE org.gate_card (
    gate_card_idx     integer     NOT NULL UNIQUE,
    employee_card_id  text        UNIQUE REFERENCES org.employee_card(card_id),
    vendor_card_id    text        UNIQUE REFERENCES org.vendor_worker(card_id),
    gate_a            boolean     NOT NULL DEFAULT false,
    gate_b            boolean     NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT gate_card_one_card CHECK ((employee_card_id IS NULL) <> (vendor_card_id IS NULL))
);
COMMENT ON TABLE org.gate_card IS '카드별 게이트 출입 권한. 게이트 a·b = 회사 정문. 사원증은 a·b 모두, 하청은 업체별 하나';

-- 출입 로그: 게이트 통과마다 1행. IN 이면 clock_in_at 만, OUT 이면 clock_out_at 만
CREATE TABLE org.employee_gate_log (
    employee_gate_log_idx  integer     NOT NULL UNIQUE,
    employee_card_id       text        NOT NULL REFERENCES org.employee_card(card_id),
    work_date              date        NOT NULL,                            -- 근무 시작 날짜 (야간조는 시작한 날)
    gate                   text        NOT NULL CHECK (gate IN ('a', 'b')),
    clock_in_at            timestamptz,
    clock_out_at           timestamptz,
    in_out                 text        NOT NULL CHECK (in_out IN ('IN', 'OUT')),
    created_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT employee_gate_log_one_time CHECK (
        (in_out = 'IN'  AND clock_in_at IS NOT NULL AND clock_out_at IS NULL) OR
        (in_out = 'OUT' AND clock_out_at IS NOT NULL AND clock_in_at IS NULL))
);
CREATE INDEX employee_gate_log_card_date_idx ON org.employee_gate_log (employee_card_id, work_date);

CREATE TABLE org.vendor_gate_log (
    vendor_gate_log_idx  integer     NOT NULL UNIQUE,
    vendor_card_id       text        NOT NULL REFERENCES org.vendor_worker(card_id),
    work_date            date        NOT NULL,
    clock_in_at          timestamptz,
    clock_out_at         timestamptz,
    in_out               text        NOT NULL CHECK (in_out IN ('IN', 'OUT')),
    created_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vendor_gate_log_one_time CHECK (
        (in_out = 'IN'  AND clock_in_at IS NOT NULL AND clock_out_at IS NULL) OR
        (in_out = 'OUT' AND clock_out_at IS NOT NULL AND clock_in_at IS NULL))
);
COMMENT ON TABLE org.vendor_gate_log IS '하청 출입 로그. 게이트는 업체별로 고정이라 gate 컬럼 없음';

-- ---------------------------------------------------------------------
-- 4. 근태
-- ---------------------------------------------------------------------

-- 출근한 날 목록 (출입 로그 IN 으로 트리거가 자동 추가)
CREATE TABLE org.attendance (
    attendance_idx  integer     NOT NULL UNIQUE,
    employee_no     text        NOT NULL REFERENCES org.employee(employee_no),
    work_date       date        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (employee_no, work_date)
);

-- 근무 기록 (출입 로그 OUT 으로 트리거가 자동 계산, 결근 행은 직접 넣음)
CREATE TABLE org.employee_record (
    employee_record_idx  integer     NOT NULL UNIQUE,
    employee_no          text        NOT NULL REFERENCES org.employee(employee_no),
    work_date            date        NOT NULL,
    actual_hour          double precision,
    overtime_hour        double precision,
    late                 boolean     NOT NULL DEFAULT false,
    early_leave          boolean     NOT NULL DEFAULT false,
    absent               boolean     NOT NULL DEFAULT false,
    work_deficit         boolean     NOT NULL DEFAULT false,
    created_at           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (employee_no, work_date)
);
COMMENT ON TABLE org.employee_record IS '판정 기준은 설명서 "근무 기준". 교대조 8시간, 정시 9시간. 초과근무 = 근무 끝 시각 뒤 30분 이상 일한 시간';

-- ---------------------------------------------------------------------
-- 5. 페이지 권한 9개 (접근 코드당 1행, 행 없으면 접근 불가)
-- ---------------------------------------------------------------------

DO $$
DECLARE
  p text;
BEGIN
  FOREACH p IN ARRAY ARRAY['main', 'process_optimization', 'quality_inspection', 'defect_labeling',
                           'ppe_violation', 'hr_management', 'management_report', 'model_management',
                           'company_documents']
  LOOP
    EXECUTE format($f$
      CREATE TABLE org.%1$I (
          %2$I          integer     NOT NULL UNIQUE,
          page_code     text        NOT NULL DEFAULT %3$L REFERENCES org.page(page_code) CHECK (page_code = %3$L),
          access_code   integer     PRIMARY KEY,
          access_level  text        NOT NULL CHECK (access_level IN ('read', 'edit')),
          created_at    timestamptz NOT NULL DEFAULT now()
      )$f$, p || '_page', p || '_page_idx', p);
    EXECUTE format('COMMENT ON TABLE org.%I IS %L', p || '_page',
                   p || ' 페이지 권한. read = 보기, edit = 보기 + 수정 버튼. 기준은 설명서 "페이지 권한"');
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 6. 앱 기록 (기존 그대로)
-- ---------------------------------------------------------------------

CREATE TABLE org.change_log (
    change_id   bigserial   PRIMARY KEY,
    table_name  text        NOT NULL,
    row_idx     integer     NOT NULL,
    op          char(1)     NOT NULL CHECK (op IN ('I', 'U', 'D')),
    changed_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.change_log IS 'org 테이블 변경 기록 (lake 복제용). 트리거 log_change 가 씀';

CREATE TABLE org.hr_access_log (
    hr_access_log_idx  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    viewer_no          text        NOT NULL,
    action             text        NOT NULL CHECK (action IN ('view_list', 'view_detail', 'create', 'update', 'delete')),
    target             text        NOT NULL,
    field_tier         text        NOT NULL CHECK (field_tier IN ('basic', 'manage', 'hr')),
    row_count          integer     NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hr_access_log_viewer_idx ON org.hr_access_log (viewer_no, created_at);
COMMENT ON TABLE org.hr_access_log IS '개인정보 조회·변경 기록. 추가만 가능';

-- =====================================================================
-- 7. 함수·트리거
-- =====================================================================

-- 7-1. 변경 기록 (기존 함수 그대로)
CREATE FUNCTION org.log_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'org'
AS $$
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

-- 다음 idx (트리거가 행을 만들 때 사용)
CREATE FUNCTION org.next_idx(t text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'org'
AS $$
DECLARE n integer;
BEGIN
  EXECUTE format('SELECT COALESCE(MAX(%I), 0) + 1 FROM org.%I', t || '_idx', t) INTO n;
  RETURN n;
END $$;

-- 7-2. 접근 코드 계산
CREATE FUNCTION org.calc_access_code(emp text) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'org'
AS $$
  SELECT p.position_code
       + e.dept_code
       + CASE WHEN d.department_representative = e.employee_no THEN 100 ELSE 0 END
       + COALESCE(e.team_code, 0)
       + CASE WHEN t.team_representative = e.employee_no THEN 1 ELSE 0 END
  FROM org.employee e
  JOIN org."position" p ON p.position_name = e.position_name
  JOIN org.department d ON d.dept_code = e.dept_code
  LEFT JOIN org.team t ON t.team_code = e.team_code
  WHERE e.employee_no = emp
$$;

CREATE FUNCTION org.refresh_access_code(emp text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'org'
AS $$
DECLARE c integer;
BEGIN
  IF emp IS NULL OR NOT EXISTS (SELECT 1 FROM org.employee WHERE employee_no = emp) THEN RETURN; END IF;
  c := org.calc_access_code(emp);
  IF EXISTS (SELECT 1 FROM org.access_code WHERE employee_no = emp) THEN
    UPDATE org.access_code SET access_code = c WHERE employee_no = emp AND access_code IS DISTINCT FROM c;
  ELSE
    INSERT INTO org.access_code (access_code_idx, employee_no, access_code)
    VALUES (org.next_idx('access_code'), emp, c);
  END IF;
END $$;

-- 7-3. 사원이 바뀌면: 접근 코드 + 부서·팀 명단
CREATE FUNCTION org.on_employee_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'org'
AS $$
BEGIN
  -- 부서 명단
  IF EXISTS (SELECT 1 FROM org.dept_roster WHERE employee_no = NEW.employee_no) THEN
    UPDATE org.dept_roster SET dept_code = NEW.dept_code
     WHERE employee_no = NEW.employee_no AND dept_code IS DISTINCT FROM NEW.dept_code;
  ELSE
    INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no)
    VALUES (org.next_idx('dept_roster'), NEW.dept_code, NEW.employee_no);
  END IF;
  -- 팀 명단 (팀 없으면 행 없음)
  IF NEW.team_code IS NULL THEN
    DELETE FROM org.team_roster WHERE employee_no = NEW.employee_no;
  ELSIF EXISTS (SELECT 1 FROM org.team_roster WHERE employee_no = NEW.employee_no) THEN
    UPDATE org.team_roster SET team_code = NEW.team_code
     WHERE employee_no = NEW.employee_no AND team_code IS DISTINCT FROM NEW.team_code;
  ELSE
    INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no)
    VALUES (org.next_idx('team_roster'), NEW.team_code, NEW.employee_no);
  END IF;
  -- 접근 코드
  PERFORM org.refresh_access_code(NEW.employee_no);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_employee_sync
    AFTER INSERT OR UPDATE OF dept_code, position_name, team_code ON org.employee
    FOR EACH ROW EXECUTE FUNCTION org.on_employee_change();

-- 7-4. 부서장·팀장이 바뀌면: 전·후 사람의 접근 코드
CREATE FUNCTION org.on_representative_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'org'
AS $$
DECLARE old_rep text; new_rep text;
BEGIN
  IF TG_TABLE_NAME = 'department' THEN
    old_rep := CASE WHEN TG_OP = 'UPDATE' THEN OLD.department_representative END;
    new_rep := NEW.department_representative;
  ELSE
    old_rep := CASE WHEN TG_OP = 'UPDATE' THEN OLD.team_representative END;
    new_rep := NEW.team_representative;
  END IF;
  IF old_rep IS DISTINCT FROM new_rep THEN
    PERFORM org.refresh_access_code(old_rep);
    PERFORM org.refresh_access_code(new_rep);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_department_rep
    AFTER INSERT OR UPDATE OF department_representative ON org.department
    FOR EACH ROW EXECUTE FUNCTION org.on_representative_change();
CREATE TRIGGER trg_team_rep
    AFTER INSERT OR UPDATE OF team_representative ON org.team
    FOR EACH ROW EXECUTE FUNCTION org.on_representative_change();

-- 7-5. 직급 코드가 바뀌면: 그 직급 전원의 접근 코드
CREATE FUNCTION org.on_position_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'org'
AS $$
BEGIN
  PERFORM org.refresh_access_code(e.employee_no) FROM org.employee e WHERE e.position_name = NEW.position_name;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_position_code
    AFTER UPDATE OF position_code ON org."position"
    FOR EACH ROW EXECUTE FUNCTION org.on_position_change();

-- 7-5-1. 퇴사 처리: 부서장·팀장은 막기, 퇴사면 게이트 막기, 재직으로 돌리면 다시 열기
CREATE FUNCTION org.on_employee_resign() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'org'
AS $$
BEGIN
  IF NEW.employment_status IS NOT DISTINCT FROM OLD.employment_status THEN
    RETURN NULL;
  END IF;
  IF NEW.employment_status = 'resigned' THEN
    IF EXISTS (SELECT 1 FROM org.department WHERE department_representative = NEW.employee_no)
       OR EXISTS (SELECT 1 FROM org.team WHERE team_representative = NEW.employee_no) THEN
      RAISE EXCEPTION '부서장·팀장은 퇴사 처리할 수 없습니다. 대표자를 먼저 바꾸세요: %', NEW.employee_no;
    END IF;
    UPDATE org.gate_card g SET gate_a = false, gate_b = false
      FROM org.employee_card c
     WHERE c.employee_no = NEW.employee_no AND g.employee_card_id = c.card_id;
  ELSE
    UPDATE org.gate_card g SET gate_a = true, gate_b = true
      FROM org.employee_card c
     WHERE c.employee_no = NEW.employee_no AND g.employee_card_id = c.card_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_employee_resign
    AFTER UPDATE OF employment_status ON org.employee
    FOR EACH ROW EXECUTE FUNCTION org.on_employee_resign();

-- 7-6. 근무 형태: 주조팀(casting1~3)은 3조 3교대, 1주 단위로 돌아감 / 그 외 정시 09~18
--      기준 주: 2026-08-03(월) 주에 casting1 주간, casting2 오후, casting3 야간
CREATE FUNCTION org.shift_start(emp text, d date) RETURNS timestamptz
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'org'
AS $$
DECLARE tc integer; k integer;
BEGIN
  SELECT team_code INTO tc FROM org.employee WHERE employee_no = emp;
  IF tc IN (10, 20, 30) THEN
    k := ((tc / 10 - 1) + ((date_trunc('week', d)::date - date '2026-08-03') / 7)) % 3;
    IF k < 0 THEN k := k + 3; END IF;
    RETURN (d + make_time(CASE k WHEN 0 THEN 6 WHEN 1 THEN 14 ELSE 22 END, 0, 0)) AT TIME ZONE 'Asia/Seoul';
  END IF;
  RETURN (d + time '09:00') AT TIME ZONE 'Asia/Seoul';
END $$;

CREATE FUNCTION org.shift_hours(emp text) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'org'
AS $$
  SELECT CASE WHEN team_code IN (10, 20, 30) THEN 8 ELSE 9 END FROM org.employee WHERE employee_no = emp
$$;

-- 7-7. 출입 로그가 들어오면: 출근 기록 · 현재 상태 · 근무 기록
CREATE FUNCTION org.on_employee_gate_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'org'
AS $$
DECLARE
  emp text; first_in timestamptz; last_out timestamptz;
  s timestamptz; h integer; act double precision;
BEGIN
  SELECT employee_no INTO emp FROM org.employee_card WHERE card_id = NEW.employee_card_id;

  IF NEW.in_out = 'IN' THEN
    -- 출근 기록 (그날 첫 IN)
    INSERT INTO org.attendance (attendance_idx, employee_no, work_date)
    SELECT org.next_idx('attendance'), emp, NEW.work_date
    WHERE NOT EXISTS (SELECT 1 FROM org.attendance WHERE employee_no = emp AND work_date = NEW.work_date);
    UPDATE org.employee_card SET attendance_status = 'present'
     WHERE card_id = NEW.employee_card_id AND attendance_status <> 'present';
    RETURN NULL;
  END IF;

  -- OUT: 현재 상태 · 마지막 퇴근 · 근무 기록
  UPDATE org.employee_card SET attendance_status = 'absent'
   WHERE card_id = NEW.employee_card_id AND attendance_status <> 'absent';
  UPDATE org.employee_status SET last_logout_at = NEW.clock_out_at
   WHERE employee_no = emp AND (last_logout_at IS NULL OR last_logout_at < NEW.clock_out_at);

  SELECT MIN(clock_in_at), MAX(clock_out_at) INTO first_in, last_out
    FROM org.employee_gate_log
   WHERE employee_card_id = NEW.employee_card_id AND work_date = NEW.work_date;
  IF first_in IS NULL THEN RETURN NULL; END IF;

  s   := org.shift_start(emp, NEW.work_date);
  h   := org.shift_hours(emp);
  act := round((extract(epoch FROM last_out - first_in) / 3600.0)::numeric, 2);

  INSERT INTO org.employee_record
      (employee_record_idx, employee_no, work_date, actual_hour, overtime_hour, late, early_leave, absent, work_deficit)
  VALUES
      (org.next_idx('employee_record'), emp, NEW.work_date, act,
       CASE WHEN last_out - (s + make_interval(hours => h)) >= interval '30 minutes'
            THEN round((extract(epoch FROM last_out - (s + make_interval(hours => h))) / 3600.0)::numeric, 2) END,
       first_in > s,
       last_out < s + make_interval(hours => h),
       false,
       act < h)
  ON CONFLICT (employee_no, work_date) DO UPDATE SET
       actual_hour   = EXCLUDED.actual_hour,
       overtime_hour = EXCLUDED.overtime_hour,
       late          = EXCLUDED.late,
       early_leave   = EXCLUDED.early_leave,
       absent        = false,
       work_deficit  = EXCLUDED.work_deficit;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_employee_gate_log_sync
    AFTER INSERT ON org.employee_gate_log
    FOR EACH ROW EXECUTE FUNCTION org.on_employee_gate_log();

-- 7-8. 결근 행이 들어오면: 연차 1일 차감
CREATE FUNCTION org.on_absent() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'org'
AS $$
BEGIN
  IF NEW.absent AND (TG_OP = 'INSERT' OR NOT OLD.absent) THEN
    UPDATE org.employee_status SET annual_leave_used = LEAST(COALESCE(annual_leave_used, 0) + 1, 15)
     WHERE employee_no = NEW.employee_no;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_employee_record_absent
    AFTER INSERT OR UPDATE OF absent ON org.employee_record
    FOR EACH ROW EXECUTE FUNCTION org.on_absent();

-- 7-9. 변경 기록 트리거 (앱 기록 테이블 2개 제외 전부)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
            WHERE schemaname = 'org' AND tablename NOT IN ('change_log', 'hr_access_log')
  LOOP
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR DELETE OR UPDATE ON org.%I
                    FOR EACH ROW EXECUTE FUNCTION org.log_change()', 'trg_' || t || '_change', t);
  END LOOP;
END $$;

-- =====================================================================
-- 8. 권한 (기존과 같은 원칙)
--    role_lake : org 전체 읽기
--    role_spark: 개인정보(employee_info)·hr_access_log 제외 읽기
--    app_hr    : 인사 테이블 읽기·쓰기, hr_access_log 추가만
-- =====================================================================

DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_hr', current_database());
END $$;
GRANT USAGE ON SCHEMA org TO role_lake, role_spark, app_hr;

GRANT SELECT ON ALL TABLES IN SCHEMA org TO role_lake;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
            WHERE schemaname = 'org' AND tablename NOT IN ('employee_info', 'hr_access_log')
  LOOP
    EXECUTE format('GRANT SELECT ON org.%I TO role_spark', t);
  END LOOP;
END $$;

GRANT SELECT ON org.department, org.team, org."position", org.employee_card, org.attendance TO app_hr;
GRANT SELECT, INSERT, UPDATE, DELETE ON org.employee, org.employee_info, org.employee_status,
                                        org.access_code, org.dept_roster, org.team_roster TO app_hr;
GRANT INSERT ON org.hr_access_log TO app_hr;

ALTER DEFAULT PRIVILEGES FOR ROLE shift IN SCHEMA org GRANT SELECT ON TABLES TO role_lake;

COMMIT;
