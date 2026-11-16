-- DB 구조 검증 스크립트 (주조 데이터셋 기준)
-- 실행: docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tests/verify.sql'
-- 전체를 하나의 트랜잭션으로 실행하고 마지막에 ROLLBACK → 검증 후 데이터가 남지 않음
-- 중간에 FAIL 이 나오면 즉시 중단된다.
-- 범위: mes.investment_casting, lake.lake_investment_casting, mart.mart_investment_casting
-- 데이터가 이미 적재된 DB에서도 실행 가능 (검증 행은 2099년 날짜로 넣고 그 행만 센다)

\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages = notice;
-- 결과 표는 숨기고 PASS/FAIL 메시지만 출력
\o /dev/null

BEGIN;

-- 검증용 임시 도우미 (ROLLBACK 으로 함께 사라짐)
CREATE SCHEMA verify_tmp;
GRANT USAGE ON SCHEMA verify_tmp TO PUBLIC;

CREATE FUNCTION verify_tmp.expect_denied(p_sql text, p_label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'FAIL  [권한] % → 막혀야 하는데 실행됨', p_label;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  [권한] % → 차단됨', p_label;
END $$;

CREATE FUNCTION verify_tmp.expect_eq(p_actual bigint, p_expected bigint, p_label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_actual IS DISTINCT FROM p_expected THEN
        RAISE EXCEPTION 'FAIL  % → 기대 %, 실제 %', p_label, p_expected, p_actual;
    END IF;
    RAISE NOTICE 'PASS  % (%)', p_label, p_actual;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA verify_tmp TO PUBLIC;

\echo '=== 1. 구조 ==='
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_namespace WHERE nspname IN ('mes','lake','mart')), 3, '스키마 3개 (mes·lake·mart)');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_namespace WHERE nspname = 'meta'), 0, 'meta 스키마 없음');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_roles WHERE rolname IN
    ('role_mes','role_spark','role_mart','role_lake',
     'app_mes','app_spark','app_mart','app_lake')), 8, '권한 그룹·계정 8개');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('mes','lake','mart')), 3,
  '전체 테이블 3개 (mes·lake·mart 각 1개)');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.columns t JOIN information_schema.columns m
     ON m.table_schema='mes' AND m.table_name='investment_casting' AND m.column_name=t.column_name AND m.data_type=t.data_type
   WHERE t.table_schema='mart' AND t.table_name='mart_investment_casting'), 19, 'mart 컬럼 19개 (casting_id + 18), 이름·형식 mes와 같음');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='mart' AND table_name='mart_investment_casting'), 19, 'mart 컬럼 수 19개');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_constraint WHERE conrelid = 'mart.mart_investment_casting'::regclass AND contype = 'f'
     AND confrelid = 'lake.lake_investment_casting'::regclass), 1, 'mart casting_id → lake 외래키');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'mart.mart_investment_casting'::regclass AND a.attnum > 0
      AND NOT a.attisdropped AND col_description(a.attrelid, a.attnum) IS NULL), 0, 'mart 모든 컬럼에 한글 설명');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.columns l JOIN information_schema.columns m
     ON m.table_schema='mes' AND m.table_name='investment_casting' AND m.column_name=l.column_name AND m.data_type=l.data_type
   WHERE l.table_schema='lake' AND l.table_name='lake_investment_casting'), 21, 'lake 컬럼 21개, 이름·형식 mes와 같음');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='lake' AND table_name='lake_investment_casting'), 21, 'lake 컬럼 수 21개 (casting_id + 20)');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_constraint WHERE conrelid = 'lake.lake_investment_casting'::regclass AND contype = 'f'
     AND confrelid = 'mes.investment_casting'::regclass), 1, 'lake casting_id → mes 외래키');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'lake.lake_investment_casting'::regclass AND a.attnum > 0
      AND NOT a.attisdropped AND col_description(a.attrelid, a.attnum) IS NULL), 0, 'lake 모든 컬럼에 한글 설명');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='mes' AND table_name='investment_casting'), 24,
  '컬럼 24개 (casting_id + 원본 23)');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='mes' AND table_name='investment_casting'
     AND column_name='casting_id' AND ordinal_position=1 AND is_generated='ALWAYS'), 1, 'casting_id = 첫 번째 컬럼, 자동 생성');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_settings WHERE name = 'TimeZone' AND setting = 'Asia/Seoul'), 1, 'DB 시간대 Asia/Seoul');

\echo '=== 2. 원본 이름·한글 설명 ==='
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='mes' AND table_name='investment_casting'
    AND column_name IN ('line_unit','production','timestamp','date','production_count','mold_temperature',
      'facility_cycletime','production_cycletime','mechanical_strength','molten_capacity','injection_pressure',
      'sleeve_temperature','top_temp1','top_temp2','top_temp3','top_temp4','bottom_temp1','bottom_temp2',
      'bottom_temp3','bottom_temp4','biscuit_thickness','cooling_water_temp','passorfail')), 23, '원본 컬럼 이름 23개 그대로');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'mes' AND column_name <> lower(column_name)), 0, '대문자 들어간 컬럼 없음');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'mes.investment_casting'::regclass AND a.attnum > 0
      AND NOT a.attisdropped AND col_description(a.attrelid, a.attnum) IS NULL), 0, '모든 컬럼에 한글 설명(COMMENT)');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = 'mes.investment_casting'::regclass AND a.attnum > 0
      AND NOT a.attisdropped AND col_description(a.attrelid, a.attnum) LIKE '%(원본:%'), 23, '원본 컬럼 설명에 원본 이름 기록 (23개)');

\echo '=== 3. mes 적재 (app_mes) ==='
SET LOCAL ROLE app_mes;
-- 원본 값 그대로 적재 (2099년 = 검증용 행): 정상 2건 + 같은 일시·다른 생산번호 1건 + 빈 값 행 1건
INSERT INTO mes.investment_casting (line_unit, production, "timestamp", "date", production_count,
  mold_temperature, facility_cycletime, production_cycletime, mechanical_strength, molten_capacity,
  injection_pressure, sleeve_temperature, top_temp1, top_temp2, top_temp3, top_temp4,
  bottom_temp1, bottom_temp2, bottom_temp3, bottom_temp4, biscuit_thickness, cooling_water_temp, passorfail)
SELECT 'line_no1', 'CylinderHead', v.d::date, v.t::time, v.no,
       v.melt, 153, 161, 88, v.vol, 660, 416, 360, 266, 806, 1620, 655, 381, 1143, 1880, 142, 45, v.pf
FROM (VALUES
  ('2099-08-04', '7:04:11',  1,   587, 12,   0),
  ('2099-08-04', '7:05:25',  2,   579, 18,   0),
  ('2099-08-04', '7:05:25',  900, 579, 18,   0),
  ('2099-09-10', '10:00:00', 3,   0,   NULL, 1)
) AS v(d, t, no, melt, vol, pf);
\echo 'PASS  원본 적재 (검증용 4건)'
SELECT verify_tmp.expect_denied('DELETE FROM mes.investment_casting', 'mes 계정 원본 삭제');
SELECT verify_tmp.expect_denied('CREATE TABLE mart.x (id int)', 'mes 계정 mart 테이블 생성');
SELECT verify_tmp.expect_denied('SELECT 1 FROM mart.mart_investment_casting LIMIT 1', 'mes 계정 mart 접근');
RESET ROLE;

\echo '=== 4. 원본 보존·casting_id (관리자 확인) ==='
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.investment_casting WHERE "timestamp" >= '2099-01-01'), 4, '검증 행 4건 그대로');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.investment_casting WHERE "timestamp" >= '2099-01-01' AND molten_capacity IS NULL), 1, '빈 값 그대로 보존');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.investment_casting WHERE casting_id = '990804_070411_1'), 1, 'casting_id 형식 (990804_070411_1)');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.investment_casting WHERE casting_id IN ('990804_070525_2','990804_070525_900')), 2, '같은 일시도 생산번호로 구분');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.investment_casting WHERE "timestamp" = '2099-08-04' AND "date" = '07:04:11'), 1, '원본 일자·시각 그대로 보존');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.investment_casting WHERE "timestamp" >= '2099-01-01' AND passorfail = 1), 1, '품질 결과 원본 값(0/1) 그대로');
DO $$ BEGIN
  INSERT INTO mes.investment_casting ("timestamp", "date", production_count) VALUES ('2099-08-04', '7:04:11', 1);
  RAISE EXCEPTION 'FAIL  [무결성] 같은 casting_id가 두 번 들어감';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS  [무결성] 같은 casting_id 중복 적재 차단';
END $$;
DO $$ BEGIN
  INSERT INTO mes.investment_casting (casting_id, "timestamp", "date", production_count) VALUES ('x', '2099-08-05', '7:00:00', 1);
  RAISE EXCEPTION 'FAIL  [무결성] casting_id 직접 입력이 허용됨';
EXCEPTION WHEN generated_always THEN
  RAISE NOTICE 'PASS  [무결성] casting_id 직접 입력 차단 (자동 생성만)';
END $$;

\echo '=== 5. Spark (app_spark) ==='
SET LOCAL ROLE app_spark;
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.investment_casting WHERE "timestamp" >= '2099-01-01'), 4, 'spark 원본 읽기');
SELECT verify_tmp.expect_denied('INSERT INTO mes.investment_casting (production_count) VALUES (1)', 'spark 원본 쓰기');
SELECT verify_tmp.expect_denied('UPDATE mes.investment_casting SET mold_temperature = 600', 'spark 원본 수정');
SELECT verify_tmp.expect_denied('DELETE FROM mes.investment_casting', 'spark 원본 삭제');
-- lake 채우기 (Spark 역할)
INSERT INTO lake.lake_investment_casting (casting_id, "timestamp", "date", mold_temperature, molten_capacity, passorfail)
SELECT casting_id, "timestamp", "date", mold_temperature, molten_capacity, passorfail
FROM mes.investment_casting WHERE "timestamp" >= '2099-01-01';
SELECT verify_tmp.expect_eq((SELECT count(*) FROM lake.lake_investment_casting WHERE casting_id LIKE '99%'), 4, 'spark lake 쓰기 (검증 행 4건)');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM lake.lake_investment_casting WHERE casting_id = '990910_100000_3' AND molten_capacity IS NULL AND mold_temperature = 0 AND "timestamp" = '2099-09-10'), 1, 'lake 값 그대로 복사 (0·빈 값 포함)');
DO $$ BEGIN
  INSERT INTO lake.lake_investment_casting (casting_id) VALUES ('없는_원본_id');
  RAISE EXCEPTION 'FAIL  [무결성] mes에 없는 casting_id가 lake에 들어감';
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'PASS  [무결성] mes에 없는 casting_id는 lake에 못 들어감 (외래키)';
END $$;
-- mart 채우기 (Spark 역할): molten_capacity 결측 행 제외
INSERT INTO mart.mart_investment_casting (casting_id, mold_temperature, molten_capacity, passorfail)
SELECT casting_id, mold_temperature, molten_capacity, passorfail
FROM lake.lake_investment_casting WHERE casting_id LIKE '99%' AND molten_capacity IS NOT NULL AND passorfail IS NOT NULL;
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mart.mart_investment_casting WHERE casting_id LIKE '99%'), 3, 'spark mart 쓰기 (검증 행 4건 중 결측 1건 제외 → 3건)');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mart.mart_investment_casting WHERE casting_id = '990910_100000_3'), 0, 'molten_capacity 결측 행은 mart에 없음');
DO $$ BEGIN
  INSERT INTO mart.mart_investment_casting (casting_id, passorfail) VALUES ('없는_lake_id', 0);
  RAISE EXCEPTION 'FAIL  [무결성] lake에 없는 casting_id가 mart에 들어감';
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'PASS  [무결성] lake에 없는 casting_id는 mart에 못 들어감 (외래키)';
END $$;
DO $$ BEGIN
  INSERT INTO mart.mart_investment_casting (casting_id, passorfail) VALUES ('990804_070411_1', NULL);
  RAISE EXCEPTION 'FAIL  [무결성] 정답 없는 행이 mart에 들어감';
EXCEPTION WHEN not_null_violation THEN
  RAISE NOTICE 'PASS  [무결성] 정답(passorfail) 빈 행은 mart에 못 들어감';
END $$;
RESET ROLE;
SET LOCAL ROLE app_mes;
SELECT verify_tmp.expect_denied('SELECT 1 FROM lake.lake_investment_casting LIMIT 1', 'mes 계정 lake 접근');
RESET ROLE;

\echo '=== 6. AI 학습 (app_mart) ==='
SET LOCAL ROLE app_mart;
SELECT verify_tmp.expect_denied('SELECT 1 FROM mes.investment_casting LIMIT 1', 'mart 계정 원본 접근');
SELECT verify_tmp.expect_denied('SELECT 1 FROM lake.lake_investment_casting LIMIT 1', 'mart 계정 lake 스키마 접근');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mart.mart_investment_casting WHERE casting_id LIKE '99%'), 3, 'mart 계정 mart 읽기');
SELECT verify_tmp.expect_denied('DELETE FROM mart.mart_investment_casting', 'mart 계정 mart 수정');
RESET ROLE;

\echo '=== 7. 조회 (app_lake) ==='
SET LOCAL ROLE app_lake;
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.investment_casting WHERE "timestamp" >= '2099-01-01'), 4, 'lake 계정 원본 읽기');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM lake.lake_investment_casting WHERE casting_id LIKE '99%'), 4, 'lake 계정 lake 스키마 읽기');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mart.mart_investment_casting WHERE casting_id LIKE '99%'), 3, 'lake 계정 mart 읽기');
SELECT verify_tmp.expect_denied('INSERT INTO mes.investment_casting (production_count) VALUES (1)', 'lake 계정 쓰기');
RESET ROLE;

\echo '=== 8. 기타 ==='
SET LOCAL ROLE app_mes;
SELECT verify_tmp.expect_denied('CREATE TABLE public.tmp_x (id int)', 'public 스키마 임의 테이블 생성');
RESET ROLE;

ROLLBACK;
\echo ''
\echo '=== 모든 검증 통과 (검증 데이터는 ROLLBACK 으로 제거됨) ==='
