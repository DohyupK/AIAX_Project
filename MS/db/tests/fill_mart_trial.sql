-- 시험 채우기: lake.lake_investment_casting → mart.mart_investment_casting
-- 조건: molten_capacity 결측 행(약 22%)과 passorfail(정답) 빈 행은 학습에 쓰지 않으므로 제외. 나머지는 값 그대로.
-- 정식으로는 Spark 작업이 담당. 실행 전 lake에 데이터가 있어야 함 (tests/fill_lake_trial.sql).
-- 이미 있는 casting_id는 건너뜀 → 여러 번 실행해도 한 벌.
\set ON_ERROR_STOP on
INSERT INTO mart.mart_investment_casting (casting_id, mold_temperature, facility_cycletime, production_cycletime, mechanical_strength, molten_capacity, injection_pressure, sleeve_temperature, top_temp1, top_temp2, top_temp3, top_temp4, bottom_temp1, bottom_temp2, bottom_temp3, bottom_temp4, biscuit_thickness, cooling_water_temp, passorfail)
SELECT casting_id, mold_temperature, facility_cycletime, production_cycletime, mechanical_strength, molten_capacity, injection_pressure, sleeve_temperature, top_temp1, top_temp2, top_temp3, top_temp4, bottom_temp1, bottom_temp2, bottom_temp3, bottom_temp4, biscuit_thickness, cooling_water_temp, passorfail
FROM lake.lake_investment_casting
WHERE molten_capacity IS NOT NULL AND passorfail IS NOT NULL
ON CONFLICT (casting_id) DO NOTHING;

SELECT (SELECT count(*) FROM lake.lake_investment_casting)                               AS lake_cnt,
       (SELECT count(*) FROM lake.lake_investment_casting WHERE molten_capacity IS NULL OR passorfail IS NULL) AS excluded_cnt,
       (SELECT count(*) FROM mart.mart_investment_casting)                               AS mart_cnt,
       (SELECT sum(passorfail) FROM mart.mart_investment_casting)                        AS mart_defect_cnt;
