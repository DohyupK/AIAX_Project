-- 시험 채우기: mes.investment_casting → lake.lake_investment_casting (값 그대로 복사)
-- 정식으로는 Spark 작업이 담당. 이상값은 EDA 검토 결과 그대로 둠.
-- 실행 전 mes에 데이터가 있어야 함 (tests/load_csv_trial.sql). 이미 있는 casting_id는 건너뜀 → 여러 번 실행해도 한 벌.
\set ON_ERROR_STOP on
INSERT INTO lake.lake_investment_casting (casting_id, "timestamp", "date", mold_temperature, facility_cycletime, production_cycletime, mechanical_strength, molten_capacity, injection_pressure, sleeve_temperature, top_temp1, top_temp2, top_temp3, top_temp4, bottom_temp1, bottom_temp2, bottom_temp3, bottom_temp4, biscuit_thickness, cooling_water_temp, passorfail)
SELECT casting_id, "timestamp", "date", mold_temperature, facility_cycletime, production_cycletime, mechanical_strength, molten_capacity, injection_pressure, sleeve_temperature, top_temp1, top_temp2, top_temp3, top_temp4, bottom_temp1, bottom_temp2, bottom_temp3, bottom_temp4, biscuit_thickness, cooling_water_temp, passorfail
FROM mes.investment_casting
ON CONFLICT (casting_id) DO NOTHING;

SELECT (SELECT count(*) FROM mes.investment_casting)       AS mes_cnt,
       (SELECT count(*) FROM lake.lake_investment_casting) AS lake_cnt,
       (SELECT count(*) FROM mes.investment_casting m JOIN lake.lake_investment_casting l USING (casting_id)
         WHERE (m."timestamp", m."date", m.mold_temperature, m.molten_capacity, m.top_temp2, m.passorfail)
               IS NOT DISTINCT FROM (l."timestamp", l."date", l.mold_temperature, l.molten_capacity, l.top_temp2, l.passorfail)) AS same_value_cnt;
