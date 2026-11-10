-- 영역별 권한
--            mes        lake       mart
-- mes        읽기·쓰기  -          -
-- spark      읽기       읽기·쓰기  읽기·쓰기
-- mart       -          -          읽기
-- lake(조회) 읽기       읽기       읽기
-- 삭제(DELETE/TRUNCATE)는 원본 영역에 주지 않음 → 원본 보존

GRANT USAGE ON SCHEMA mes  TO role_mes, role_spark, role_lake;
GRANT USAGE ON SCHEMA lake TO role_spark, role_lake;
GRANT USAGE ON SCHEMA mart TO role_spark, role_mart, role_lake;

-- mes 적재
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA mes TO role_mes;

-- spark
GRANT SELECT ON ALL TABLES IN SCHEMA mes TO role_spark;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA lake TO role_spark;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA mart TO role_spark;

-- mart 학습 읽기
GRANT SELECT ON ALL TABLES IN SCHEMA mart TO role_mart;

-- lake(조회 계정 role_lake): 전 스키마 읽기
GRANT SELECT ON ALL TABLES IN SCHEMA mes, lake, mart TO role_lake;

-- IDENTITY 컬럼 시퀀스
GRANT USAGE ON ALL SEQUENCES IN SCHEMA lake, mart TO role_spark;

-- 나중에 관리자가 추가하는 테이블에도 같은 권한 자동 적용
ALTER DEFAULT PRIVILEGES IN SCHEMA mes  GRANT SELECT, INSERT, UPDATE ON TABLES TO role_mes;
ALTER DEFAULT PRIVILEGES IN SCHEMA mes  GRANT SELECT ON TABLES TO role_spark, role_lake;
ALTER DEFAULT PRIVILEGES IN SCHEMA mes  GRANT USAGE ON SEQUENCES TO role_mes;
ALTER DEFAULT PRIVILEGES IN SCHEMA lake GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO role_spark;
ALTER DEFAULT PRIVILEGES IN SCHEMA lake GRANT SELECT ON TABLES TO role_lake;
ALTER DEFAULT PRIVILEGES IN SCHEMA lake GRANT USAGE ON SEQUENCES TO role_spark;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO role_spark;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO role_mart, role_lake;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT USAGE ON SEQUENCES TO role_spark;
