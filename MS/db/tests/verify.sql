-- DB 구조 검증 스크립트
-- 실행: docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tests/verify.sql'
-- 전체를 하나의 트랜잭션으로 실행하고 마지막에 ROLLBACK → 검증 후 데이터가 남지 않음
-- 중간에 FAIL 이 나오면 즉시 중단된다.

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
  (SELECT count(*) FROM pg_namespace WHERE nspname IN ('mes','lake','mart','meta')), 4, '스키마 4개');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_roles WHERE rolname IN
    ('role_producer','role_spark','role_ml','role_readonly',
     'app_producer','app_spark','app_ml','app_readonly')), 8, '권한 그룹·계정 8개');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema IN ('mes','lake','mart','meta')
      AND table_name IN ('equipment','sensor_tag','lot','raw_record','sensor_reading',
                         'lot_sensor_summary','lot_quality_label','training_dataset',
                         'ingestion_batch','pipeline_run')), 12, '주요 테이블 12개');
SELECT verify_tmp.expect_eq(
  (SELECT count(*) FROM pg_settings WHERE name = 'TimeZone' AND setting = 'Asia/Seoul'), 1, 'DB 시간대 Asia/Seoul');

\echo '=== 2. Data Producing APP (app_producer) ==='
SET LOCAL ROLE app_producer;

INSERT INTO meta.ingestion_batch (source_type, source_name) VALUES ('excel', 'verify_sample.xlsx');
SELECT verify_tmp.expect_eq(
  meta.ensure_monthly_partitions('mes.sensor_reading', '2026-01-01', '2026-02-28'), 2, '원본 월 파티션 생성');
SELECT verify_tmp.expect_eq(
  meta.ensure_monthly_partitions('mes.sensor_reading', '2026-01-01', '2026-02-28'), 0, '파티션 중복 생성 방지');

INSERT INTO mes.equipment (equipment_id, equipment_name, equipment_type) VALUES ('FURNACE-01', '1호 침탄로', '침탄로');
INSERT INTO mes.sensor_tag (equipment_id, tag_code, unit) VALUES
  ('FURNACE-01', 'zone1_temp', 'degC'), ('FURNACE-01', 'carbon_potential', '%');
INSERT INTO mes.lot (lot_id, equipment_id, recipe_code, started_at, ended_at) VALUES
  ('LOT-A', 'FURNACE-01', 'RCP-01', '2026-01-10 08:00+09', '2026-01-10 12:00+09'),
  ('LOT-B', 'FURNACE-01', 'RCP-01', '2026-02-05 08:00+09', '2026-02-05 12:30+09');

INSERT INTO mes.raw_record (batch_id, source_row_no, payload)
SELECT max(batch_id), 2, '{"time":"2026-01-10 08:00","zone1_temp":905.2,"carbon_potential":0.81}'::jsonb
FROM meta.ingestion_batch;

-- 1월 2건 + 같은 시각 중복 1건 + 2월 2건 + 파티션 없는 기간(2025-12) 1건
INSERT INTO mes.sensor_reading (measured_at, tag_id, lot_id, value, batch_id)
SELECT v.t::timestamptz, st.tag_id, v.lot, v.val, (SELECT max(batch_id) FROM meta.ingestion_batch)
FROM (VALUES
  ('2026-01-10 08:00+09', 'zone1_temp',       'LOT-A', 905.2),
  ('2026-01-10 08:00+09', 'zone1_temp',       'LOT-A', 905.2),
  ('2026-01-10 08:00+09', 'carbon_potential', 'LOT-A', 0.81),
  ('2026-02-05 08:00+09', 'zone1_temp',       'LOT-B', 910.0),
  ('2026-02-05 08:01+09', 'zone1_temp',       'LOT-B', NULL),
  ('2025-12-31 23:59+09', 'zone1_temp',       NULL,    899.9)
) AS v(t, tag, lot, val)
JOIN mes.sensor_tag st ON st.tag_code = v.tag;

UPDATE meta.ingestion_batch SET status = 'success', row_count = 6, finished_at = now();
\echo 'PASS  원본 적재 (기준정보·원본행·센서값·배치이력)'

SELECT verify_tmp.expect_denied('DELETE FROM mes.sensor_reading', 'producer 원본 삭제');
SELECT verify_tmp.expect_denied('SELECT 1 FROM lake.sensor_reading', 'producer lake 접근');
SELECT verify_tmp.expect_denied('INSERT INTO meta.pipeline_run (pipeline_name, source_layer, target_layer) VALUES (''x'',''mes'',''lake'')', 'producer 파이프라인이력 쓰기');
RESET ROLE;

\echo '=== 3. 파티션 라우팅 (관리자 확인) ==='
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.sensor_reading_202601), 3, '2026-01 파티션');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.sensor_reading_202602), 2, '2026-02 파티션');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mes.sensor_reading_default), 1, 'default 파티션(기간 밖 데이터 보존)');

\echo '=== 4. Spark 정제·집계 (app_spark) ==='
SET LOCAL ROLE app_spark;

INSERT INTO meta.pipeline_run (pipeline_name, source_layer, target_layer)
VALUES ('clean_sensor_reading', 'mes', 'lake');
SELECT meta.ensure_monthly_partitions('lake.sensor_reading', '2026-01-01', '2026-02-28');

-- mes → lake: (태그, 시각) 중복 제거, 결측은 quality_flag=3
INSERT INTO lake.sensor_reading (measured_at, tag_id, lot_id, value, quality_flag, pipeline_run_id)
SELECT DISTINCT ON (tag_id, measured_at)
       measured_at, tag_id, lot_id, value,
       CASE WHEN value IS NULL THEN 3 ELSE 0 END,
       (SELECT max(run_id) FROM meta.pipeline_run)
FROM mes.sensor_reading
WHERE measured_at >= '2026-01-01'
ORDER BY tag_id, measured_at, ingested_at DESC
ON CONFLICT (tag_id, measured_at) DO NOTHING;

SELECT verify_tmp.expect_eq((SELECT count(*) FROM lake.sensor_reading), 4, 'lake 중복 제거 (원본 5건 → 4건)');
SELECT verify_tmp.expect_eq((SELECT count(*) FROM lake.sensor_reading WHERE quality_flag = 3), 1, 'lake 결측 플래그');

-- 같은 데이터를 다시 넣어도 늘지 않음 (재실행 안전)
INSERT INTO lake.sensor_reading (measured_at, tag_id, lot_id, value, pipeline_run_id)
SELECT measured_at, tag_id, lot_id, value, (SELECT max(run_id) FROM meta.pipeline_run)
FROM mes.sensor_reading WHERE measured_at >= '2026-01-01'
ON CONFLICT (tag_id, measured_at) DO NOTHING;
SELECT verify_tmp.expect_eq((SELECT count(*) FROM lake.sensor_reading), 4, 'lake 재실행 시 중복 없음');

INSERT INTO lake.lot (lot_id, equipment_id, recipe_code, started_at, ended_at, pipeline_run_id)
SELECT lot_id, equipment_id, recipe_code, started_at, ended_at, (SELECT max(run_id) FROM meta.pipeline_run)
FROM mes.lot;
SELECT verify_tmp.expect_eq((SELECT duration_sec FROM lake.lot WHERE lot_id = 'LOT-B'), 16200, 'lake LOT 작업시간 자동계산(초)');

-- lake → mart: LOT × 센서 요약
INSERT INTO meta.pipeline_run (pipeline_name, source_layer, target_layer)
VALUES ('build_lot_sensor_summary', 'lake', 'mart');
INSERT INTO mart.lot_sensor_summary
  (lot_id, tag_id, sample_count, value_min, value_max, value_avg, value_stddev, first_at, last_at, pipeline_run_id)
SELECT lot_id, tag_id, count(value), min(value), max(value), avg(value), stddev_samp(value),
       min(measured_at), max(measured_at), (SELECT max(run_id) FROM meta.pipeline_run)
FROM lake.sensor_reading
WHERE lot_id IS NOT NULL AND quality_flag IN (0, 1)
GROUP BY lot_id, tag_id;
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mart.lot_sensor_summary), 3, 'mart LOT×센서 요약');

INSERT INTO mart.lot_quality_label (lot_id, label_class, source) VALUES ('LOT-A', 'OK', 'verify');
INSERT INTO mart.training_dataset (dataset_name, version, definition, row_count)
VALUES ('quality_baseline', 1, '{"from":"2026-01-01","to":"2026-02-28"}', 3);
UPDATE meta.pipeline_run SET status = 'success', finished_at = now();
\echo 'PASS  Spark 흐름 (mes → lake → mart, 실행이력)'

SELECT verify_tmp.expect_denied('INSERT INTO mes.equipment (equipment_id, equipment_name) VALUES (''X'',''X'')', 'spark 원본 쓰기');
SELECT verify_tmp.expect_denied('DELETE FROM mes.sensor_reading', 'spark 원본 삭제');
RESET ROLE;

\echo '=== 5. AI 학습 (app_ml) ==='
SET LOCAL ROLE app_ml;
SELECT verify_tmp.expect_eq((SELECT count(*) FROM mart.lot_sensor_summary), 3, 'ml mart 읽기');
SELECT verify_tmp.expect_denied('SELECT 1 FROM lake.sensor_reading', 'ml lake 접근');
SELECT verify_tmp.expect_denied('SELECT 1 FROM mes.sensor_reading', 'ml 원본 접근');
SELECT verify_tmp.expect_denied('DELETE FROM mart.lot_sensor_summary', 'ml mart 수정');
RESET ROLE;

\echo '=== 6. 조회 전용 (app_readonly) ==='
SET LOCAL ROLE app_readonly;
SELECT verify_tmp.expect_eq(
  (SELECT (SELECT count(*) FROM mes.sensor_reading) + (SELECT count(*) FROM lake.sensor_reading)
        + (SELECT count(*) FROM mart.lot_sensor_summary)), 13, 'readonly 전체 읽기 (6+4+3)');
SELECT verify_tmp.expect_denied('INSERT INTO mart.lot_quality_label (lot_id, label_class) VALUES (''X'',''NG'')', 'readonly 쓰기');
RESET ROLE;

\echo '=== 7. 데이터 무결성 ==='
SET LOCAL ROLE app_producer;
SELECT verify_tmp.expect_denied('CREATE TABLE public.tmp_x (id int)', 'public 스키마 임의 테이블 생성');
RESET ROLE;
DO $$ BEGIN
  INSERT INTO mes.sensor_tag (equipment_id, tag_code) VALUES ('NO-SUCH-EQUIP', 'x');
  RAISE EXCEPTION 'FAIL  [무결성] 없는 설비 태그가 들어감';
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'PASS  [무결성] 없는 설비 참조 차단';
END $$;
DO $$ BEGIN
  INSERT INTO mes.lot (lot_id, started_at, ended_at) VALUES ('BAD', '2026-01-02', '2026-01-01');
  RAISE EXCEPTION 'FAIL  [무결성] 종료가 시작보다 빠른 LOT 이 들어감';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS  [무결성] LOT 시간 역전 차단';
END $$;

ROLLBACK;
\echo ''
\echo '=== 모든 검증 통과 (검증 데이터는 ROLLBACK 으로 제거됨) ==='
