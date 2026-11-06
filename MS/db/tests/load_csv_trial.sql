-- 시험 적재: 원본 CSV 전체를 mes.investment_casting에 넣어 DBeaver 등에서 확인하기 위한 임시 스크립트
-- (정식 적재는 Data Producing APP이 담당. 다시 비우려면 docker compose down -v 후 up -d)
-- 실행 전: docker compose cp data/raw/Investment_Casting.csv postgres:/tmp/cast.csv
-- 같은 파일을 두 번 넣으면 casting_id 중복으로 전체가 거부된다 (한 벌만 들어감).
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE csv_in (
    line_unit text, production text, "timestamp" text, "date" text, production_count text,
    mold_temperature text, facility_CycleTime text, production_CycleTime text, mechanical_strength text,
    molten_capacity text, injection_pressure text, sleeve_temperature text,
    top_temp1 text, top_temp2 text, top_temp3 text, top_temp4 text,
    bottom_temp1 text, bottom_temp2 text, bottom_temp3 text, bottom_temp4 text,
    biscuit_thickness text, cooling_water_temp text, PassOrFail text
);
\copy csv_in FROM '/tmp/cast.csv' WITH (FORMAT csv, HEADER true)
ALTER TABLE csv_in ADD COLUMN row_no serial;

INSERT INTO mes.investment_casting (line_unit, production, "timestamp", "date", production_count,
  mold_temperature, facility_cycletime, production_cycletime, mechanical_strength, molten_capacity,
  injection_pressure, sleeve_temperature, top_temp1, top_temp2, top_temp3, top_temp4,
  bottom_temp1, bottom_temp2, bottom_temp3, bottom_temp4, biscuit_thickness, cooling_water_temp,
  passorfail)
SELECT line_unit, production, "timestamp"::date, "date"::time, production_count::numeric::int,
  mold_temperature::float8, facility_CycleTime::float8, production_CycleTime::float8, mechanical_strength::float8,
  molten_capacity::float8, injection_pressure::float8, sleeve_temperature::float8,
  top_temp1::float8, top_temp2::float8, top_temp3::float8, top_temp4::float8,
  bottom_temp1::float8, bottom_temp2::float8, bottom_temp3::float8, bottom_temp4::float8,
  biscuit_thickness::float8, cooling_water_temp::float8, PassOrFail::numeric::smallint
FROM csv_in ORDER BY row_no;

COMMIT;

SELECT count(*) AS row_cnt, count(DISTINCT casting_id) AS casting_id_cnt, sum(passorfail) AS defect_cnt,
       count(*) FILTER (WHERE molten_capacity IS NULL) AS molten_null_cnt
FROM mes.investment_casting;
