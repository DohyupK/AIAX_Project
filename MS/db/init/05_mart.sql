-- Data Mart 영역 (mart) — AI 학습·분석용 데이터
-- Spark가 lake 데이터를 가공해 저장한다. AI 학습 계정(app_ml)은 이 영역만 읽는다.
-- (2026-11-07) mart.mart_investment_casting: casting_id(lake 참조 외래키) + 학습용 18개 컬럼.
--   빠진 컬럼: timestamp·date(날짜 라벨 문제), (production_count·line_unit·production은 lake 단계에서 이미 제외)
--   채우는 조건: molten_capacity 결측 행(약 22%, 16,316행)과 passorfail(정답) 빈 행(1행)은 학습에 쓰지 않으므로 넣지 않음 → 57,295행

CREATE TABLE mart.mart_investment_casting (
    casting_id            text PRIMARY KEY
                          REFERENCES lake.lake_investment_casting (casting_id),  -- 외래키: lake 정제 행
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
    passorfail            smallint NOT NULL               -- 정답 없는 행은 학습 불가 → 빈 값 금지
);
