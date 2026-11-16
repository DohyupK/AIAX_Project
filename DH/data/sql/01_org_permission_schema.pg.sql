-- 조직·권한 Postgres 스키마 (기존 aiax DB · schema org)
-- 명세: DB연동_내역/조직권한_테이블구조.md

CREATE SCHEMA IF NOT EXISTS org;

COMMENT ON SCHEMA org IS '조직·권한·하청·게이트·근태 (DH)';

-- 예약어 position → 따옴표
CREATE TABLE IF NOT EXISTS org."position" (
    position_idx   integer NOT NULL UNIQUE,
    position_name  text    NOT NULL PRIMARY KEY,
    position_code  integer NOT NULL UNIQUE,
    created_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org."position" IS '직급 마스터';

CREATE TABLE IF NOT EXISTS org.department (
    department_idx             integer NOT NULL UNIQUE,
    dept_code                  text    NOT NULL PRIMARY KEY,
    dept_name                  text    NOT NULL,
    department_representative  text    NULL,
    created_at                 timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.department IS '부서 마스터';

CREATE TABLE IF NOT EXISTS org.team (
    team_idx             integer NOT NULL UNIQUE,
    team_code            text    NOT NULL PRIMARY KEY,
    team_representative  text    NULL,
    created_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.team IS '팀 마스터';

CREATE TABLE IF NOT EXISTS org.employee (
    employee_idx   integer NOT NULL UNIQUE,
    employee_no    text    NOT NULL PRIMARY KEY,
    dept_code      text    NOT NULL REFERENCES org.department(dept_code),
    position_name  text    NOT NULL REFERENCES org."position"(position_name),
    team_code      text    NULL REFERENCES org.team(team_code),
    created_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.employee IS '사원';

CREATE TABLE IF NOT EXISTS org.employee_info (
    employee_info_idx  integer NOT NULL UNIQUE,
    employee_no        text    NOT NULL PRIMARY KEY REFERENCES org.employee(employee_no),
    employee_name      text    NOT NULL,
    age                integer NOT NULL,
    gender             text    NOT NULL CHECK (gender IN ('M', 'F', 'other')),
    phone              text    NOT NULL,
    address            text    NOT NULL,
    email              text    NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.employee_status (
    employee_status_idx    integer NOT NULL UNIQUE,
    employee_no            text    NOT NULL PRIMARY KEY REFERENCES org.employee(employee_no),
    monthly_overtime_hour  double precision NULL,
    last_logout_at         timestamptz NULL,
    annual_leave_used      integer NULL CHECK (
        annual_leave_used IS NULL
        OR (annual_leave_used >= 0 AND annual_leave_used <= 15)
    ),
    years_of_service       integer NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN org.employee_status.monthly_overtime_hour IS 'actual-10, ≤0이면 null (로직 모듈)';
COMMENT ON COLUMN org.employee_status.years_of_service IS '오늘 - employee.created_at (로직 모듈)';

CREATE TABLE IF NOT EXISTS org.employee_card (
    employee_card_idx  integer NOT NULL UNIQUE,
    card_id            text    NOT NULL PRIMARY KEY,
    employee_no        text    NOT NULL UNIQUE REFERENCES org.employee(employee_no),
    attendance_status  text    NOT NULL CHECK (
        attendance_status IN ('present', 'absent')
    ),
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.attendance (
    attendance_idx integer NOT NULL UNIQUE,
    employee_no    text    NOT NULL REFERENCES org.employee(employee_no),
    work_date      date    NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (employee_no, work_date)
);

CREATE TABLE IF NOT EXISTS org.access_code (
    access_code_idx integer NOT NULL UNIQUE,
    employee_no     text    NOT NULL PRIMARY KEY REFERENCES org.employee(employee_no),
    access_code     integer NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN org.access_code.access_code IS '시드 전용 산식. org_permission_logic 모듈 아님';

CREATE TABLE IF NOT EXISTS org.page (
    page_idx   integer NOT NULL UNIQUE,
    page_code  text    NOT NULL PRIMARY KEY,
    page_name  text    NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.model_management_page (
    model_management_page_idx integer NOT NULL UNIQUE,
    page_code                 text    NOT NULL REFERENCES org.page(page_code),
    dept_code                 text    NOT NULL REFERENCES org.department(dept_code),
    position_name             text    NOT NULL REFERENCES org."position"(position_name),
    page_feature              text    NOT NULL,
    access_level              text    NULL CHECK (
        access_level IS NULL OR access_level IN ('read', 'edit')
    ),
    created_at                timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dept_code, position_name, page_feature)
);

CREATE TABLE IF NOT EXISTS org.main_page (
    main_page_idx integer NOT NULL UNIQUE,
    page_code     text    NOT NULL REFERENCES org.page(page_code),
    dept_code     text    NOT NULL REFERENCES org.department(dept_code),
    position_name text    NOT NULL REFERENCES org."position"(position_name),
    page_feature  text    NOT NULL,
    access_level  text    NULL CHECK (
        access_level IS NULL OR access_level IN ('read', 'edit')
    ),
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dept_code, position_name, page_feature)
);

CREATE TABLE IF NOT EXISTS org.process_optimization_page (
    process_optimization_page_idx integer NOT NULL UNIQUE,
    page_code                     text    NOT NULL REFERENCES org.page(page_code),
    dept_code                     text    NOT NULL REFERENCES org.department(dept_code),
    position_name                 text    NOT NULL REFERENCES org."position"(position_name),
    page_feature                  text    NOT NULL,
    access_level                  text    NULL CHECK (
        access_level IS NULL OR access_level IN ('read', 'edit')
    ),
    created_at                    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dept_code, position_name, page_feature)
);

CREATE TABLE IF NOT EXISTS org.quality_inspection_page (
    quality_inspection_page_idx integer NOT NULL UNIQUE,
    page_code                   text    NOT NULL REFERENCES org.page(page_code),
    dept_code                   text    NOT NULL REFERENCES org.department(dept_code),
    position_name               text    NOT NULL REFERENCES org."position"(position_name),
    page_feature                text    NOT NULL,
    access_level                text    NULL CHECK (
        access_level IS NULL OR access_level IN ('read', 'edit')
    ),
    created_at                  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dept_code, position_name, page_feature)
);

CREATE TABLE IF NOT EXISTS org.worker_safety_page (
    worker_safety_page_idx integer NOT NULL UNIQUE,
    page_code              text    NOT NULL REFERENCES org.page(page_code),
    dept_code              text    NOT NULL REFERENCES org.department(dept_code),
    position_name          text    NOT NULL REFERENCES org."position"(position_name),
    page_feature           text    NOT NULL,
    access_level           text    NULL CHECK (
        access_level IS NULL OR access_level IN ('read', 'edit')
    ),
    created_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dept_code, position_name, page_feature)
);

CREATE TABLE IF NOT EXISTS org.management_report_page (
    management_report_page_idx integer NOT NULL UNIQUE,
    page_code                  text    NOT NULL REFERENCES org.page(page_code),
    dept_code                  text    NOT NULL REFERENCES org.department(dept_code),
    position_name              text    NOT NULL REFERENCES org."position"(position_name),
    page_feature               text    NOT NULL,
    access_level               text    NULL CHECK (
        access_level IS NULL OR access_level IN ('read', 'edit')
    ),
    created_at                 timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dept_code, position_name, page_feature)
);

CREATE TABLE IF NOT EXISTS org.dept_roster (
    dept_roster_idx integer NOT NULL UNIQUE,
    dept_code       text NOT NULL REFERENCES org.department(dept_code),
    employee_no     text NOT NULL UNIQUE REFERENCES org.employee(employee_no),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.team_roster (
    team_roster_idx integer NOT NULL UNIQUE,
    team_code       text NOT NULL REFERENCES org.team(team_code),
    employee_no     text NOT NULL UNIQUE REFERENCES org.employee(employee_no),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.vender_company (
    vender_company_idx integer NOT NULL UNIQUE,
    vender_code        text    NOT NULL PRIMARY KEY,
    vender_name        text    NOT NULL,
    contract_status    text    NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.vender_worker (
    vender_worker_idx integer NOT NULL UNIQUE,
    vender_code       text    NOT NULL REFERENCES org.vender_company(vender_code),
    card_id           text    NOT NULL PRIMARY KEY,
    card_issued_at    timestamptz NOT NULL,
    card_returned_at  timestamptz NULL,
    gate              text    NOT NULL CHECK (gate IN ('a', 'b')),
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.gate_card (
    gate_card_idx      integer NOT NULL UNIQUE,
    employee_card_id   text    NULL UNIQUE REFERENCES org.employee_card(card_id),
    vender_card_id     text    NULL UNIQUE REFERENCES org.vender_worker(card_id),
    gate_a             text    NULL CHECK (gate_a IS NULL OR gate_a = 'O'),
    gate_b             text    NULL CHECK (gate_b IS NULL OR gate_b = 'O'),
    created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE org.gate_card IS '게이트 권한. 사원=양쪽 O, vender=카드 끝 a/b';

CREATE TABLE IF NOT EXISTS org.employee_gate_log (
    employee_gate_log_idx integer NOT NULL UNIQUE,
    employee_card_id      text    NOT NULL REFERENCES org.employee_card(card_id),
    work_date             date    NOT NULL,
    clock_in_at           timestamptz NULL,
    clock_out_at          timestamptz NULL,
    commute_type          text    NOT NULL CHECK (commute_type IN ('IN', 'OUT')),
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.vender_gate_log (
    vender_gate_log_idx integer NOT NULL UNIQUE,
    vender_card_id      text    NOT NULL REFERENCES org.gate_card(vender_card_id),
    work_date           date    NOT NULL,
    clock_in_at         timestamptz NULL,
    clock_out_at        timestamptz NULL,
    commute_type        text    NOT NULL CHECK (commute_type IN ('IN', 'OUT')),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org.employee_record (
    employee_record_idx integer NOT NULL UNIQUE,
    employee_card_id    text    NOT NULL REFERENCES org.employee_card(card_id),
    work_date           date    NOT NULL,
    actual_hour         double precision NULL,
    overtime_hour       double precision NULL,
    late                text    NULL,
    early_leave         text    NULL,
    absent              text    NULL,
    work_deficit        text    NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN org.employee_record.actual_hour IS 'org_permission_logic.compute_actual_hour';
COMMENT ON COLUMN org.employee_record.overtime_hour IS 'org_permission_logic.compute_overtime_hour (actual-9)';
COMMENT ON COLUMN org.employee_record.late IS '자동판정 없음. 시드 예시값 가능';

-- 조회 계정(role_lake / app_lake)
GRANT USAGE ON SCHEMA org TO role_lake;
GRANT SELECT ON ALL TABLES IN SCHEMA org TO role_lake;
ALTER DEFAULT PRIVILEGES IN SCHEMA org GRANT SELECT ON TABLES TO role_lake;
