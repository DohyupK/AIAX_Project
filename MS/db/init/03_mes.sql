-- 원본 영역 (mes) — 주조(다이캐스팅) 공정 데이터
-- 원칙: 원본 값을 고치지 않고 그대로 보관한다 (빈 값·이상값·중복도 그대로). 정제는 lake 단계에서 한다.
-- 이름: 명명규칙.md 2절(원본 이름 우선). 테이블 이름은 원본 파일 이름(Investment_Casting.csv)을 소문자로.
-- (2026-11-07) 원본 CSV의 timestamp 연도를 2021 → 2026으로 변경 (CSV 파일 자체 수정, 그 외 값은 원본 그대로).
-- (2026-11-07) raw_record(jsonb 백업) 삭제, cast_shot → investment_casting 으로 이름 변경, casting_id 추가.

-- 주조 원본 (제품 1개 생산 = 1행)
-- casting_id: 원본 값으로 자동 생성되는 행 식별자 = 생산일자(yymmdd)_생산시각(hhmmss)_생산번호
--   예) 2026-08-04, 7:04:11, production_count 1 → 260804_070411_1
--   원본 timestamp(날짜) 라벨이 실제 날짜와 달라 날짜+시각만으로는 302쌍이 겹침 → 생산번호까지 포함.
--   DB가 계산하는 컬럼(GENERATED)이라 적재 시 넣지 않으며, 원본 23개 컬럼은 그대로 보관한다.
CREATE TABLE mes.investment_casting (
    casting_id            text GENERATED ALWAYS AS (
        lpad((extract(year  FROM "timestamp")::int % 100)::text, 2, '0') ||
        lpad( extract(month FROM "timestamp")::int::text, 2, '0') ||
        lpad( extract(day   FROM "timestamp")::int::text, 2, '0') || '_' ||
        lpad( extract(hour   FROM "date")::int::text, 2, '0') ||
        lpad( extract(minute FROM "date")::int::text, 2, '0') ||
        lpad( floor(extract(second FROM "date"))::int::text, 2, '0') || '_' ||
        production_count::text
    ) STORED PRIMARY KEY,
    line_unit             text,
    production            text,
    timestamp             date,
    date                  time,
    production_count      integer,
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

CREATE INDEX investment_casting_date_idx ON mes.investment_casting ("timestamp", "date");   -- 원본 일자·시각 기준 조회
