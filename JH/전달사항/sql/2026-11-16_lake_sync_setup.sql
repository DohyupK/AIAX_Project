-- mes·org → lake 복제 + 변경 기록(자동 갱신 준비) — 2026-11-16, DH·MS 승인
-- 설계: JH/전달사항/2026-11-16_MS_mes변경시_lake자동갱신_요청.md
-- MS: 이 파일을 MS/db/init/ 에 반영(번호는 MS 규칙) + 루트 DB구조.md 갱신
-- 갱신 실행(00:00 KST 실행기 · Spark 작업)은 MS가 추가 예정. 이 파일은 "기록 + 첫 전체 복제"까지.
-- 기본값: employee_info(개인정보) 복제 제외 / 기존 lake.lake_investment_casting 외래키 변경 없음
-- 다시 실행해도 안전하도록 IF NOT EXISTS · ON CONFLICT 사용

BEGIN;

-- ===== 0. 워터마크 (Spark가 어디까지 반영했는지) =====
CREATE TABLE IF NOT EXISTS lake.etl_watermark (
    job_name        text        PRIMARY KEY,
    last_change_id  bigint      NOT NULL DEFAULT 0,
    last_run_at     timestamptz
);
INSERT INTO lake.etl_watermark (job_name) VALUES ('mes_to_lake'), ('org_to_lake')
ON CONFLICT (job_name) DO NOTHING;

-- ===== 1. mes 변경 기록 =====
CREATE TABLE IF NOT EXISTS mes.investment_casting_change_log (
    change_id   bigserial   PRIMARY KEY,
    casting_id  text        NOT NULL,
    op          char(1)     NOT NULL CHECK (op IN ('I', 'U', 'D')),
    changed_at  timestamptz NOT NULL DEFAULT now()
);

-- SECURITY DEFINER: mes에 쓰는 계정(app_mes 등)에 기록 테이블 권한을 따로 주지 않아도 기록되게
CREATE OR REPLACE FUNCTION mes.log_investment_casting_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, mes AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (NEW.casting_id, 'I');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO mes.investment_casting_change_log (casting_id, op) VALUES (OLD.casting_id, 'D');
  ELSIF NEW.casting_id IS DISTINCT FROM OLD.casting_id THEN
    -- casting_id는 날짜·시각·생산번호로 자동 생성 → 키가 바뀌면 "옛 키 삭제 + 새 키 추가"
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

-- ===== 2. org 변경 기록 (공용, 키 = <테이블>_idx) =====
CREATE TABLE IF NOT EXISTS org.change_log (
    change_id   bigserial   PRIMARY KEY,
    table_name  text        NOT NULL,
    row_idx     integer     NOT NULL,
    op          char(1)     NOT NULL CHECK (op IN ('I', 'U', 'D')),
    changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION org.log_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, org AS $$
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

-- ===== 3. org 테이블마다: 트리거 + lake_<테이블> 생성 + 첫 전체 복제 =====
DO $$
DECLARE t text; n bigint;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'org' AND c.relkind = 'r'
      AND c.relname NOT IN ('change_log', 'employee_info')   -- employee_info: 개인정보라 제외
    ORDER BY c.relname
  LOOP
    -- 규칙 확인: <테이블>_idx 칼럼이 없으면 중단 (키 없이 복제하지 않음)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'org' AND table_name = t AND column_name = t || '_idx') THEN
      RAISE EXCEPTION 'org.% 에 %_idx 칼럼이 없습니다', t, t;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON org.%I', 'trg_' || t || '_change', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON org.%I
                    FOR EACH ROW EXECUTE FUNCTION org.log_change()', 'trg_' || t || '_change', t);

    -- lake 사본: 칼럼·기본값 동일, 키 = <테이블>_idx, 원본 외래키는 복제하지 않음
    EXECUTE format('CREATE TABLE IF NOT EXISTS lake.%I (LIKE org.%I INCLUDING DEFAULTS, PRIMARY KEY (%I))',
                   'lake_' || t, t, t || '_idx');
    -- 첫 전체 복제 (다시 실행 시 이미 있는 행은 건너뜀 — 이후 변경은 Spark가 반영)
    EXECUTE format('INSERT INTO lake.%I SELECT * FROM org.%I ON CONFLICT (%I) DO NOTHING',
                   'lake_' || t, t, t || '_idx');
    EXECUTE format('SELECT count(*) FROM lake.%I', 'lake_' || t) INTO n;
    RAISE NOTICE 'lake.lake_% : % 행', t, n;
  END LOOP;
END $$;

-- ===== 4. 권한 =====
GRANT USAGE ON SCHEMA org TO role_spark;
GRANT SELECT ON ALL TABLES IN SCHEMA org TO role_spark;
REVOKE SELECT ON org.employee_info FROM role_spark;               -- 개인정보는 Spark에서도 제외
GRANT SELECT ON mes.investment_casting_change_log TO role_spark, role_lake;
GRANT SELECT ON org.change_log TO role_spark, role_lake;
GRANT SELECT, UPDATE ON lake.etl_watermark TO role_spark;
GRANT SELECT ON lake.etl_watermark TO role_lake;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA lake TO role_spark;
GRANT SELECT ON ALL TABLES IN SCHEMA lake TO role_lake;

COMMIT;
