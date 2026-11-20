-- 31 로그인 계정 (2026-11-21, MS · JH 요청)
-- 웹 로그인 계정. 지금까지 JH 임시 SQLite → 정식 테이블
-- 사번 1개 = 계정 1개, 사원 삭제 시 계정도 삭제
-- 이름·이메일은 저장 안 함 → org.employee_info 원본 사용 (가입 시 입력 이메일이 인사 이메일과 같은지 확인용으로만 씀)
-- DB 계정: app_hr 재사용. lake·spark 에는 권한 없음 (비밀번호 해시 복제 방지, change_log 트리거도 안 붙임)
-- 09 뒤에 실행. 다시 실행해도 됨
BEGIN;

CREATE TABLE IF NOT EXISTS org.app_user (
    app_user_idx   bigint      GENERATED ALWAYS AS IDENTITY UNIQUE,
    user_id        text        PRIMARY KEY
                   CHECK (user_id ~ '^[a-z0-9][a-z0-9._-]{3,19}$'),          -- 소문자·숫자로 시작, 4~20자
    password_hash  text        NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
    employee_no    text        NOT NULL UNIQUE
                   REFERENCES org.employee (employee_no) ON DELETE CASCADE,
    created_at     timestamptz NOT NULL DEFAULT now(),
    last_login_at  timestamptz
);
COMMENT ON TABLE org.app_user IS '웹 로그인 계정. 이름·이메일은 org.employee_info 사용';

GRANT SELECT, INSERT ON org.app_user TO app_hr;
GRANT UPDATE (last_login_at, password_hash) ON org.app_user TO app_hr;
REVOKE ALL ON org.app_user FROM role_lake, role_spark;   -- 09 를 다시 실행해 org 전체 SELECT 가 생겨도 막히게 (아래 확인)

COMMIT;

-- 확인: app_hr 만 권한, 행 0
SELECT grantee, string_agg(privilege_type, ', ') AS 권한
FROM information_schema.role_table_grants
WHERE table_schema = 'org' AND table_name = 'app_user'
GROUP BY grantee;
