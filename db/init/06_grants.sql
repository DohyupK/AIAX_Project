-- 영역별 권한
--            mes        lake       mart       meta
-- producer   읽기·쓰기  -          -          적재이력 쓰기
-- spark      읽기       읽기·쓰기  읽기·쓰기  파이프라인이력 쓰기
-- ml         -          -          읽기       읽기
-- readonly   읽기       읽기       읽기       읽기
-- 삭제(DELETE/TRUNCATE)는 원본 영역에 주지 않음 → 원본 보존

GRANT USAGE ON SCHEMA mes  TO role_producer, role_spark, role_readonly;
GRANT USAGE ON SCHEMA lake TO role_spark, role_readonly;
GRANT USAGE ON SCHEMA mart TO role_spark, role_ml, role_readonly;
GRANT USAGE ON SCHEMA meta TO role_producer, role_spark, role_ml, role_readonly;

-- producer
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA mes TO role_producer;
GRANT SELECT, INSERT, UPDATE ON meta.ingestion_batch     TO role_producer;

-- spark
GRANT SELECT ON ALL TABLES IN SCHEMA mes TO role_spark;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA lake TO role_spark;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA mart TO role_spark;
GRANT SELECT ON meta.ingestion_batch TO role_spark;
GRANT SELECT, INSERT, UPDATE ON meta.pipeline_run TO role_spark;

-- ml
GRANT SELECT ON ALL TABLES IN SCHEMA mart TO role_ml;
GRANT SELECT ON ALL TABLES IN SCHEMA meta TO role_ml;

-- readonly
GRANT SELECT ON ALL TABLES IN SCHEMA mes, lake, mart, meta TO role_readonly;

-- IDENTITY 컬럼 시퀀스
GRANT USAGE ON ALL SEQUENCES IN SCHEMA mes  TO role_producer;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA lake, mart TO role_spark;
GRANT USAGE ON SEQUENCE meta.ingestion_batch_batch_id_seq TO role_producer;
GRANT USAGE ON SEQUENCE meta.pipeline_run_run_id_seq      TO role_spark;

-- 파티션 생성 함수: 적재 주체만 실행
REVOKE EXECUTE ON FUNCTION meta.ensure_monthly_partitions(regclass, date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION meta.ensure_monthly_partitions(regclass, date, date) TO role_producer, role_spark;

-- 나중에 관리자가 추가하는 테이블에도 같은 권한 자동 적용
ALTER DEFAULT PRIVILEGES IN SCHEMA mes  GRANT SELECT, INSERT, UPDATE ON TABLES TO role_producer;
ALTER DEFAULT PRIVILEGES IN SCHEMA mes  GRANT SELECT ON TABLES TO role_spark, role_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA mes  GRANT USAGE ON SEQUENCES TO role_producer;
ALTER DEFAULT PRIVILEGES IN SCHEMA lake GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO role_spark;
ALTER DEFAULT PRIVILEGES IN SCHEMA lake GRANT SELECT ON TABLES TO role_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA lake GRANT USAGE ON SEQUENCES TO role_spark;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO role_spark;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO role_ml, role_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT USAGE ON SEQUENCES TO role_spark;
ALTER DEFAULT PRIVILEGES IN SCHEMA meta GRANT SELECT ON TABLES TO role_ml, role_readonly;
