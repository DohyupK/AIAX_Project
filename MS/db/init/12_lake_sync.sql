-- 12 lake 자동 갱신 준비 (2026-11-18, MS) — JH 2026-11-16 요청(lake_sync_setup) + org 새 구조 반영
-- 09·10·11 뒤에 실행. 변경 기록(mes) + 처리 위치 + lake 의 org 복사본 26개(첫 전체 복사)
-- 매일 갱신: MS/db/spark/jobs/lake_sync.py (Spark), MS/db/apps/src/apps/lake_runner.py (00:00 KST 실행기)
-- org 변경 기록(org.change_log, 트리거 log_change)은 09_org_permission.sql 에 있음
BEGIN;

-- 처리 위치 (Spark 가 어디까지 반영했는지)
CREATE TABLE IF NOT EXISTS lake.etl_watermark (
    job_name        text        PRIMARY KEY,
    last_change_id  bigint      NOT NULL DEFAULT 0,
    last_run_at     timestamptz
);
INSERT INTO lake.etl_watermark (job_name) VALUES ('mes_to_lake'), ('org_to_lake')
ON CONFLICT (job_name) DO NOTHING;

-- mes 변경 기록
CREATE TABLE IF NOT EXISTS mes.investment_casting_change_log (
    change_id   bigserial   PRIMARY KEY,
    casting_id  text        NOT NULL,
    op          char(1)     NOT NULL CHECK (op IN ('I', 'U', 'D')),
    changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION mes.log_investment_casting_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, mes AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (NEW.casting_id, 'I');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (OLD.casting_id, 'D');
  ELSIF NEW.casting_id IS DISTINCT FROM OLD.casting_id THEN
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (OLD.casting_id, 'D'), (NEW.casting_id, 'I');
  ELSE
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (NEW.casting_id, 'U');
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_investment_casting_change_row ON mes.investment_casting;
CREATE TRIGGER trg_investment_casting_change_row
AFTER INSERT OR UPDATE OR DELETE ON mes.investment_casting
FOR EACH ROW EXECUTE FUNCTION mes.log_investment_casting_change();

GRANT SELECT ON mes.investment_casting_change_log TO role_spark, role_lake;
GRANT SELECT, UPDATE ON lake.etl_watermark TO role_spark;
GRANT SELECT ON lake.etl_watermark TO role_lake;

-- lake 의 org 복사본 (employee_info·hr_access_log·change_log 제외)
-- 새 구조로 만들고 전체 복사 (컬럼은 org 와 같음, 키 = <테이블>_idx)
DO $$
DECLARE
  t text;
  src text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'position', 'department', 'team', 'page', 'vendor_company',
    'employee', 'employee_status', 'access_code', 'dept_roster', 'team_roster',
    'employee_card', 'vendor_worker', 'gate_card', 'employee_gate_log', 'vendor_gate_log',
    'attendance', 'employee_record',
    'main_page', 'process_optimization_page', 'quality_inspection_page', 'defect_labeling_page',
    'ppe_violation_page', 'hr_management_page', 'management_report_page', 'model_management_page',
    'company_documents_page']
  LOOP
    src := format('org.%I', t);
    EXECUTE format('CREATE TABLE lake.%I (LIKE %s INCLUDING DEFAULTS)', 'lake_' || t, src);
    EXECUTE format('ALTER TABLE lake.%I ADD PRIMARY KEY (%I)', 'lake_' || t, t || '_idx');
    EXECUTE format('INSERT INTO lake.%I SELECT * FROM %s', 'lake_' || t, src);
    EXECUTE format('COMMENT ON TABLE lake.%I IS %L', 'lake_' || t, 'org.' || t || ' 복사본 (Spark org_to_lake 가 매일 00:00 KST 갱신)');
  END LOOP;
END $$;

-- Spark 처리 위치: 지금까지의 org 변경은 위 전체 복사에 포함됨
INSERT INTO lake.etl_watermark (job_name, last_change_id, last_run_at)
VALUES ('org_to_lake', (SELECT COALESCE(MAX(change_id), 0) FROM org.change_log), now())
ON CONFLICT (job_name) DO UPDATE
   SET last_change_id = EXCLUDED.last_change_id, last_run_at = EXCLUDED.last_run_at;

-- 권한: 조회 계정 읽기, Spark 읽기·쓰기
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
            WHERE schemaname = 'lake' AND tablename LIKE 'lake\_%'
              AND tablename <> 'lake_investment_casting'
  LOOP
    EXECUTE format('GRANT SELECT ON lake.%I TO role_lake', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON lake.%I TO role_spark', t);
  END LOOP;
END $$;

COMMIT;
