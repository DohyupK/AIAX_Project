-- Data Lake 영역 (lake) — 정제 데이터
-- Spark가 mes 원본을 정제해 저장한다. 원본 컬럼 이름은 mes와 같게 유지한다 (명명규칙.md 2절).
-- (2026-11-07) lake.lake_investment_casting: casting_id(mes 참조 외래키) + 원본 20개 컬럼.
--   빠진 컬럼: line_unit·production(값이 하나뿐), production_count(casting_id에 포함)
--   mes 값을 그대로 복사 (이상값·센서 오류값은 EDA 검토 결과 그대로 두기로 함, 2026-11-07).
--   염두: 중복 정리, 일자+시각 병합(생산 일시), 월 파티션

CREATE TABLE lake.lake_investment_casting (
    casting_id            text PRIMARY KEY
                          REFERENCES mes.investment_casting (casting_id),  -- 외래키: mes 원본 행
    timestamp             date,
    date                  time,
    mold_temperature      double precision,
    facility_cycletime    double precision,
    production_cycletime  double precision,
    mechanical_strength   double precision,
    molten_capacity       double precision,
    injection_pressure    double precision,
    sleeve_temperature    double precision,
    top_temp1             double precision,
    top_temp2             double precision,
    top_temp3             double precision,
    top_temp4             double precision,
    bottom_temp1          double precision,
    bottom_temp2          double precision,
    bottom_temp3          double precision,
    bottom_temp4          double precision,
    biscuit_thickness     double precision,
    cooling_water_temp    double precision,
    passorfail            smallint
);
