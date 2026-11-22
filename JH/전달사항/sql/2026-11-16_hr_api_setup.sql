-- 인사 관리 API(JH/api/hr) 전용 DB 설정 — 2026-11-16, DH 승인
-- 계정 app_hr 생성·비밀번호는 실행 스크립트가 따로 처리 (비밀번호는 루트 .env 의 APP_HR_PASSWORD, 이 파일에 없음)
-- MS: MS/db/init/ 반영(00_roles.sh 에 app_hr, 이 파일은 번호 규칙에 맞춰) + 루트 DB구조.md 갱신
-- 다시 실행해도 안전 (IF NOT EXISTS)

BEGIN;

-- 개인정보 조회·변경 기록 (누가 · 언제 · 무엇을) — 개인정보 안전성 확보조치 기준의 접속기록
-- 규칙 예외: lake 복제 대상 아님 (기록의 기록을 만들지 않음, org.change_log 트리거 없음)
CREATE TABLE IF NOT EXISTS org.hr_access_log (
    hr_access_log_idx  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    viewer_no          text        NOT NULL,              -- 조회·변경한 사원 (로그인 전: 목업 계정)
    action             text        NOT NULL CHECK (action IN ('view_list', 'view_detail', 'create', 'update', 'delete')),
    target             text        NOT NULL,              -- 예: 'team=casting1', 'dept=30', 'E30019'
    field_tier         text        NOT NULL CHECK (field_tier IN ('basic', 'manage', 'hr')),
    row_count          integer     NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_access_log_viewer_idx ON org.hr_access_log (viewer_no, created_at);

-- app_hr: org 인사 테이블만. mes·lake·mart 접근 없음
GRANT USAGE ON SCHEMA org TO app_hr;
GRANT SELECT ON org.department, org.team, org."position",
                org.employee, org.employee_info, org.employee_status, org.access_code,
                org.dept_roster, org.team_roster,
                org.employee_card, org.attendance              -- 삭제 전 참조 확인용 (읽기만)
             TO app_hr;
GRANT INSERT, UPDATE, DELETE ON org.employee, org.employee_info, org.employee_status, org.access_code,
                                org.dept_roster, org.team_roster
             TO app_hr;
GRANT INSERT ON org.hr_access_log TO app_hr;               -- 기록은 추가만 (수정·삭제 불가)

COMMIT;
